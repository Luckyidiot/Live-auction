<?php

namespace App\Http\Controllers;

use Illuminate\Support\Facades\Redis;
use Illuminate\Http\Request;
use Illuminate\Support\Str;
use Illuminate\Support\Facades\Cookie;

use Illuminate\Cookie\CookieValuePrefix;

use App\Models\Auction;
use App\Models\AuctionBids;
use App\Models\AuctionItem;
use App\Models\AutoImage;
use App\Models\AutoItem;
use App\Models\SystemOption;

class AuctionController extends Controller {
    
    
    public function viewAuction(Request $request, $idauctions){
        $auction = Auction::select(["auction_name", "auction_dt", "status"])->find($idauctions);
        if (!$auction || $auction["status"] != config("constants.Auction_Status.READY")){
            return redirect("/auctionerror")->with("error_message", "Auction either is not ready or does not exist or is already done!");
        }
      
        $auctionItems = AuctionItem::select(["item_idauto", "idauction_item"])
            ->where("idauctions", "=", $idauctions)
            ->get();
        $is_jumpin = false;
        $onbid_item = null;
        $autoIDs = Redis::command("HGETALL", ["$idauctions"]); // If this is empty, it is first-time-access; otherwise, it is a jumpin
        if (!empty($autoIDs)){
            /**
                This is a jump in.
                
                - Restrict the autoIDs to the remaining one only.
                - Query the car that is being bidded. If there is none, that means the session
                auction has not started, so we will query the current car selected on the screen 
                of the admin in the front-end.
             */
            $is_jumpin = true;
            $onbid_item = $this->parse_session($autoIDs["onbid"], $idauctions, false);
            $onbid_item["id"] = $autoIDs["onbid"];
            $autoIDs = explode(",", $autoIDs["items"]);
        }
        else {
            /**
                Auction is accessed for the first time
                If that is the admin, initialize the auction record in Redis, which is a Hash.
                
                It contains 2 fields:
                "items" => A string of the id of items separated by a comma.
                "onbid" => The item which is being selected on the screen of the admin. Because this is
                           the first access, this will be set to the first id.
            */
            $autoIDs = $auctionItems->pluck("item_idauto");
            $listOf_itemIDs = $autoIDs->toArray();
            
            Redis::command("HSET",["$idauctions",
                "items", implode(",", $listOf_itemIDs),
                "onbid", $listOf_itemIDs[0]
            ]);
        }
        
        /**
            Get the cars' information and images and merge them to Json
            TODO: Later, there might be more criteria to filter out some images.
         */
        $autoItems = AutoItem::find($autoIDs);
        $autoImages = AutoImage::select(["main_image", "iditem_auto_image", "iditem_auto"])
            ->whereIn("iditem_auto", $autoIDs)
            ->get()
            ->groupBy("iditem_auto");
        $autos = $this->make_auto_obj($autoItems, $autoImages, $auctionItems);
          
        /**
            1) Store the auction id to session
            2) Issue the WS One-time password
            
            - To avoid admin sending request to wrong auction
            - To authenticate the websocket handshake.
         */
        session(["idauction" => $idauctions]);
        $this->issue_WS_OTP($request, $idauctions);
        
        /**
            Get the additional price for auction buttons
         */
        $price_buttons = SystemOption::select(["num_value"])
            ->where("tablename", "ActionPricePlusButton")
            ->get()->pluck("num_value");
        
        /**
            The admin site is a lot different. It need one extra piece of information.
         */
        $data = [
            "price_buttons" => $price_buttons,
            "is_jumpin" => $is_jumpin,
            "onbid_item" => $onbid_item,
            
            "auction" => $auction,
            "autos" => $autos,
            "total_autos" => count($auctionItems),
            "bidderid" => $request->user()['idbidder'],
            "biddertype" => $request->user()['type']
        ];
        if ($request->user()["type"] == config("constants.Bidder_Type.Admin")){
            $options = SystemOption::select(["tablename", "int_value", "str_name", "str_value"])
                ->where("tablename", "InHouseNumbers")
                ->orWhere("tablename", "DecisionButtons")
                ->get()->groupBy("tablename");
            $data["inhouse_numbers"] = $options["InHouseNumbers"]->pluck("int_value");
            $data["decisionbuttons"] = $options["DecisionButtons"]->pluck("str_value", "str_name");
        }
        
        return view("liveauction", $data);
    }
    
    
    public function cacheNewPrice(Request $request){
        
        $auctionid = session("idauction", null);
    
        /**
        Pre-check stage, ensure two things:
        1) The auction's session status is running
        2) The newly bidprice must be higher.
         */
        $auction_session = Redis::command("HGETALL", ["$auctionid:$request->auctionitemid"]);
        if (empty($auction_session) || $auction_session["status"] != config("constants.Auction_Session.RUNNING")){
            return response()->json(["message" => "Fail to bid"], 500);
        }
        if (!is_numeric($request->bidprice) || $request->bidprice <= floatval($auction_session["bidprice"])){
            return response()->json(["message" => "Fail, new price must be higher than current price"], 500);
        }
        
        /**
            Form the $biddersyntax to set to redis Hash.
            Its syntax is "bidtype:id:bidorder".
         */
        $bidorder = intval($auction_session["bidorder"]) + 1;
        if ($request->user()["type"] == config("constants.Bidder_Type.Admin")){
            $id = $request->inHouseID;
        }
        else {
            $id = $request->user()["idbidder"];
        }
        $biddersyntax = implode(":", [$request->bidtype, $id, $bidorder]);
        
        
        // Broadcast the new price.
        Redis::publish("$auctionid", json_encode([
            "type" => "BIDPRICE",
            "data" => [
                "bidprice" => $request->bidprice,
                "bidtype" => $request->bidtype,
                "bidder" => explode(":", $biddersyntax),
                "auctionitemid" => $request->auctionitemid
            ]
        ]));
        Redis::command("HSET", ["$auctionid:$request->auctionitemid",
            // This is used to ensure any oerride in any fields.
            "bidprice", $request->bidprice,
            "winner", $biddersyntax, //Automatically set it to admin at this time.
            "bidorder", $bidorder,
            // We need to record every bid of each bidder, so its key will have the syntax of
            // bidtype:bidderid:bidorder
            // "bidturn" is simply a number that will increase every time a bidder bid to avoid override in Hash.
            $biddersyntax, date("Y-m-d H:i:s")."|".$request->ip()."|$request->bidprice"
        ]);
        
        return response()->json(["message" => "Bid successfully"]);
    }
    
    
    public function create_AuctionSession(Request $request){
        
        $auctionid = $request->session()->get("idauction");
        if (Redis::command("EXISTS", ["$auctionid:$request->auctionitemid"])){
            return response()->json(["message" => "This auction session already existed, cannot create more"], 500);
        }
        
        Redis::publish($auctionid, json_encode([
            "type" => "START"
        ]));
        
        
        /**
            Description of the Hash of auction session
            
            - The id of auction and item which is being bidded are used to form the name
                of the hash.
            - The first three fields are meta data of the auction session.
            - "bidprice" is used to track the highest bid price.
            - "status" is used to determine if it should accept any further writes. "RUNIING" or "FINISH" or "PAUSED".
            - "winner" has the syntax of "biddertype:bidderid:bidorder".
         */
        Redis::command("HSET", ["$auctionid:$request->auctionitemid",
            "status", config("constants.Auction_Session.RUNNING"),
            "bidorder", 0,
            "winner", "none:0:0",
            "bidprice", $request->floor_price
        ]);
        
        return response()->json(["message" => "Auction session was created"]);
    }
    
    
    
    public function record_AuctionSession(Request $request){
        /**
            PRE-CHECK some information, including:
            
            1) The auction hash that keeps track of items' ids and the id of item being bidded.
            2) If the requested id matchs with the one in the "onbid" field of the auction hash.
            3) Status of the auction session, if it is PAUSED, proceed; otherwise, suspend.
            
            The 2) and 3) behaviors may need further adjustment to ask the admin if they want to proceed with them,
            if they do, proceed; otherwise, abort. Right now, just return with error.
         */
        $auctionid = session("idauction", null);
        $auction = Redis::command("HGETALL", [$auctionid]);
        $auction_session = $this->parse_session($request->auctionitemid, $auctionid, true);
        $decisions = SystemOption::select(["str_value"])
            ->where("tablename", "DecisionButtons")
            ->get()->pluck("str_value");
            
        if (is_null($auctionid) || empty($auction_session)){
            return response()->json([
                "message" => "Auction session does not exist."
            ], 500);
        }
        if (!in_array($request->decision, $decisions->toArray())){
            return response()->json([
                "message" => "The decision you set does not exist"
            ], 500);
        }
        if ($auction["onbid"] != $request->auctionitemid){
            return response()->json([
                "message" => "The requested car's id to save does not match with the one which being bidded."
            ], 500);
        }
        if ($auction_session["status"] != config("constants.Auction_Session.PAUSED")){
            return response()->json([
                "message" => "The session is not paused, cannot save it."
            ], 500);
        }
        
        /**
            REMOVE ID IN THE AUCTION HASH & REMOVE THE SESSION & RESET THE STATUS for AUCTION
            
            Doing so to update the remaining cars which will be bidded.
            The ids in the "items" field are placed in ordered, so we will assume the admin want to proceed
            to the next one in order. 
            So we will remove the id that the admin requests to save and set the leftmost id in the "onbid" field.
            
            If there is not any id left in "items" field, remove the entire hash, the auction is done. Also change the
            status of the auction in MySQL.
            
            
         */
        Redis::command("DEL", ["$auctionid:$request->auctionitemid"]);
        $item_ids = explode(",", $auction["items"]);
        $is_done = false;
        for ($i = 0; $i < count($item_ids); $i++){
            if ($item_ids[$i] == $request->auctionitemid){
                array_splice($item_ids, $i, 1);
                break;
            }
        }
        if (empty($item_ids)){
            Redis::command("HDEL", array_keys($auction));
            Auction::where("idauctions", $auctionid)
                ->update(["status" => config("constants.Auction_Status.DONE")]);
            $is_done = true;
            
        }
        else {
            Redis::command("HSET", [$auctionid,
                "items", implode(",", $item_ids),
                "onbid", $item_ids[0]
            ]);
        }
        
        
        /**
            NO BIDS IN THIS SESSION
            Save data in auction item table only, no need to save any bids.
            Return with no winner.
        */
        if (preg_match("/none/", $auction_session["winner"])){
            AuctionItem::where("idauction_item", $request->auctionitemid)
                ->update([
                    "winner_idbidder" => 0,
                    "winning_amount" => 0,
                    "winning_bidid" => 0
                ]);
            return response()->json([
                "is_done" => $is_done,
                "message" => "There is no bid to save",
                "winner" => "None",
                "bidprice" => 0
            ]);
        }
        
        
        /** 
            SAVE BIDS & UPDATE THE REMAINING FIELDS IN auction item table.
            
            There are 2 fields that need to be determined:
                "winning_bid"       => based on the order of the bid, if the order of the bid matchs the "bidorder" 
                                       this means that is the last bid, so it is the winner.
                "pending_approval"  => If the status is "sold condition" and that bid is the winning bid, this field
                                       will be 1; otherwise, 0.
            Delete the redis hash after saving all bids to MySQL
         */
        $winner = null;
        foreach ($auction_session["data"] as $bid){
            $is_winner = false;
            $is_pending = false;
            if ($bid[2] == $auction_session["bidorder"]){
                $is_winner = true;
                if ($request->decision == "soldcon"){
                    $is_pending = true;
                }
            }
            $bid_record = AuctionBids::create([
                "idauction_item" => $request->auctionitemid,
                "idbidder" => $bid[1],
                "bidtype" => $bid[0],
                "bidamount" => $bid[3][2],
                "bid_dt" => $bid[3][0],
                "winning_bid" => $is_winner,
                "bid_ip" => $bid[3][1],
                "pending_approval" => $is_pending,
                "status" => $request->decision
            ]);
            
            if ($is_winner){
                $winner = $bid_record;
            }
        }
        AuctionItem::where("idauction_item", $request->auctionitemid)
            ->update([
                "winner_idbidder" => $winner["idbidder"],
                "winning_amount" => $winner["bidamount"],
                "winning_bidid" => $winner["idauction_bids"]
            ]);
                
        
        return response()->json([
            "is_done" => $is_done,
            "message" => "Session was saved",
            "winner" => $auction_session["winner"],
            "bidprice" => $winner["bidamount"]
        ]);
    }
    
    public function pause_AuctionSession(Request $request){
        $auctionid = session("idauction", null);
        if (!$auctionid || !Redis::command("EXISTS", ["$auctionid:$request->auctionitemid"])){
            return response()->json(["message" => "Cannot pause auction"], 500);
        }
        Redis::command("HSET", ["$auctionid:$request->auctionitemid", 
            "status", config("constants.Auction_Session.PAUSED"),
        ]);
        return response()->json(["message" => "Auction paused"]);
    }
    public function resume_AuctionSession(Request $request){
        $auctionid = session("idauction", null);
        if (!$auctionid || !Redis::command("EXISTS", ["$auctionid:$request->auctionitemid"])){
            return response()->json(["message" => "Cannot resume auction"], 500);
        }
        Redis::command("HSET", ["$auctionid:$request->auctionitemid", 
            "status", config("constants.Auction_Session.RUNNING"),
        ]);
        return response()->json(["message" => "Auction resumed"]);
    }
    
    
    private function issue_WS_OTP(Request $request, int $idauctions){
        /**
            Generate Websocket One-time Password.
            Save it in Redis.
            The format of the user is "'ws_otp':idauction:biddertype:bidderid"
            
            This is used to ensure that only valid user can connect to the websocket server.
         */
        $ws_otp = Str::uuid();
        $cookie_name = implode(":", [$idauctions, $request->user()['type'], $request->user()['idbidder']]);
        $key = env("WS_OTP_NAME", "ws_otp").":$cookie_name";
        Redis::connection("cache")->command("SET", [$key, $ws_otp, "EX", env("WS_OTP_LIFETIME", 120)]);
        Cookie::queue(env("WS_OTP_NAME", "ws_otp"), $ws_otp, env("WS_OTP_LIFETIME", 120)/60);
    }
    
    private function make_auto_obj($autoItems, $autoImages, $auctionItems){
        /**
            Merge the cars' information and their images into json
         */
        return $autoItems->map(function ($autoItem) use ($autoImages, $auctionItems) {
            // Add images to each car
            $mainImage = "";
            $images = [];
            
            foreach ($autoImages[$autoItem["iditem_auto"]] as $autoImage){
                $url = url("/inventory/{$autoItem['stockprefix']}/{$autoItem['stocknumber']}/{$autoItem['stocknumber']}_image_{$autoImage['iditem_auto_image']}.jpg");
                if ($autoImage["main_image"] == 1){
                    $mainImage = $url;
                }
                else {
                    array_push($images, $url);
                }
            }
            $autoItem["mainImage"] = $mainImage;
            $autoItem["images"] = $images;
            $autoItem["idauction_item"] = $auctionItems->where("item_idauto", "=", $autoItem["iditem_auto"])->first()["item_idauto"];
            
            // Get the floor price of each car, right now it will temporarily set to 100.98
            $autoItem["floor_price"] = 300;
            
            return $autoItem;
        });
    }
    
    private function parse_session($itemid, $auctionid, $is_saving){
        /**
            Regex matching the pattern of the hash's field, such as "Floor bid:0:8"
         */
        $bid_regex = "/(([a-zA-Z]|\s)+)\:([0-9]+)(\:)([0-9]+)/";
        $bid_data = [];
        $onbid_item = [];
        
        $auc_session = Redis::command("HGETALL", ["$auctionid:$itemid"]);
        if ($auc_session){
            foreach ($auc_session as $key => $val){
                if (preg_match($bid_regex, $key)){
                    // The record of bid
                    $data = explode(":", $key);
                    $val = explode("|", $val);
                    if ($is_saving){
                        array_push($data, $val);
                    }
                    else{
                        $price = end($val);
                        array_push($data, $price);
                    }
                    array_push($bid_data, $data);
                }
                else {
                    // The record of other trivial data of the session
                    $onbid_item[$key] = $val;
                }
            }
            $onbid_item["data"] = $bid_data;   
        }
        return $onbid_item;
    }
    
}
?>