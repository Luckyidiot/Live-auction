
// Definition of HANDLER that will determine what to do with the signal from the broadcast
const SOCKET_HANDLER = { default: () => errorDisplay("Unknow signal", true) };
function addSocketHandler(name, fn){
    SOCKET_HANDLER[name] = fn;
}
function performSocketHandler(name, ...args){
    const handler = SOCKET_HANDLER[name];
    
    if (handler){
        return handler(...args);
    }
    return SOCKET_HANDLER["default"];
}
// Socket listener
socket.addEventListener("message", function(message){
    const data = JSON.parse(message["data"]);
    performSocketHandler(data["type"], data);
});
// Register the HANDLER.
addSocketHandler("TIME", (data) => {
    if (data["data"] == "0s") {
        is_bidding = false;
        $("#timelefttobid").val("DELAY");
    } else {
        is_bidding = true;
        $("#timelefttobid").val(data["data"]);
    }
 });
addSocketHandler("BIDPRICE", (data) => {
    if (!is_bidding || data["data"]["auctionitemid"] != selected_tableitem.attr("id")){
        return;
    }
    
    update_BidBoard(data["data"]["bidder"][0], data["data"]["bidder"][1], data["data"]["bidder"][2], data["data"]["bidprice"]);
    update_HighestBid(data["data"]["bidprice"], null);
    $("#timelefttobid").removeClass("last-time");

    let maximumPrice = parseMonetaryFormat($("#maximumbid").val());
    let newPrice = parseFloat(data["data"]["bidprice"]) + 100;
    let newBidder = data["data"]["bidder"][1];
    if (maximumPrice != 0 && maximumPrice >= newPrice && bidderid != newBidder) {
        cacheBidPrice(newPrice, "Proxy bid");
    }
});

addSocketHandler("START", (data) => { 
    successDisplay("Auction starts."); 
    is_bidding = true;
    $("#timelefttobid").removeClass("last-time");
});
addSocketHandler("FINISH", (data) => {
    // The session is done, simply render the result.
    let winner = response["winner"].split(":");
    show_result(winner[1], winner[0], formatMoney(response["bidprice"]), decision_text, response["is_done"]);
    is_bidding = false;
});

addSocketHandler("NEWITEM", (data) => {
    if (is_bidding){
        return;
    }
    
    if (data["is_finish"]){
        // Remove the currently selected item
        selected_tableitem.remove();
        
        // Clear the board holding bids information
        $("#bid-record .record-row").remove();
        
        // Show that bid record again and hide the result board
        $("#bid-record").show();
        $("#session-result").empty();
        $("#session-result").hide();
        
        veh_index(total_autos);
    }
    else {
        selected_tableitem.removeClass("table-item-selected");
    }
    
    selected_tableitem = $(`.table-item#${data['itemid']}`);
    selected_tableitem.addClass("table-item-selected");
    $("#timelefttobid").removeClass("last-time");
    // Bring the images of the selected car to the carousel
    setCarousel();
    // Update the display prices on the right.
    update_PriceBoard();
    formAutoPriceButtons();
});

addSocketHandler("LASTTIME", (data) => { 
    $("#timelefttobid").val(data["data"]);
    $("#timelefttobid").addClass("last-time");
});



