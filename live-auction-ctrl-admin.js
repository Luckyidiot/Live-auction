
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
addSocketHandler("TICK", (data) => {
    /**
        Not all admins will receive TICK signal, just the first one access the auction will,
        if the first one get out of the auction, the second admin accessing the auction will 
        receive this, and so on.
     */
    // Stoping the timer just means ignoring the TICK.
    
    if (stopTimer || socket.readyState != WebSocket.OPEN){
        return;
    }
    let timeleft = parseInt($("#timelefttobid").val());
    if (timeleft == 0 || $("#timelefttobid").val() == "DELAY"){
        stopTimer = true;
        return;
    }
    socket.send(JSON.stringify({
        type: "TIME",
        data: `${timeleft - 1}s`
    }));
    
    /**
        If the time is 1, the next signal will turn the time to "DELAY" at which moment the bidders
        are not allowed to bid before the admin click to add more time. So we need to pause the
        auction session on the server.
    */
    if (timeleft == 1){
        pause_resume_Auction("pause");
    }
});
addSocketHandler("TIME", (data) => {
    /**
        Reach to 0s, before the admin can extend the time for the auction, we
        need to suspend any further bid from the regular users.
        Only the admin receiving the TICK signal will pause.
    */
    if (data["data"] == "0s") {
        $("#timelefttobid").val("DELAY");
        is_bidding = false;
    } else {
        $("#timelefttobid").val(data["data"]);
    }
});
addSocketHandler("LASTTIME", (data) => { 
    $("#timelefttobid").val(data["data"]);
    $("#timelefttobid").addClass("last-time");
});
addSocketHandler("BIDPRICE", (data) => {
    if (!is_bidding){
        return;
    }
    if (data["data"]["auctionitemid"] != selected_tableitem.attr("id")){
        /**
            This only happens when just before the jumpin got into the auction, the admin
            already finish the current car and move on to the next car. 
            
            There is not really any optimal way to confirm this, so the easiest way is to
            disable the user until the next car.
         */
        errorDisplay("You're not synced to the current progress of the auction, please wait...");
        return;
    }
    
    socket.send(JSON.stringify({
        type: "TIME",
        data: "10s"
    }));
    
    update_BidBoard(data["data"]["bidder"][0], data["data"]["bidder"][1], data["data"]["bidder"][2], data["data"]["bidprice"]);
    update_HighestBid(data["data"]["bidprice"], formFloorPriceButtons);
    $("#timelefttobid").removeClass("last-time");
});
addSocketHandler("START", (data) => { 
    successDisplay("Auction starts.", false); 
    is_bidding = true;
    stopTimer = false;
    
    // Change the button
    $("#timelefttobid").removeClass("last-time");
    if ($("#add-second")) {
        $("#add-second").show();
    }
    if ($("#control-auction")) {
        $("#control-auction").hide();
    }
});
addSocketHandler("FINISH", (data) => {
    // The session is done, simply render the result.
    data = data["data"];
    let winner = data["winner"].split(":");
    show_result(winner[1], winner[0], formatMoney(data["bidprice"]), data["decision"], data["is_done"]);
    is_bidding = false;
    is_finish = true;
    stopTimer = true;
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
        
        // Reset the button back to START
        if ($("#add-second")) {
            $("#add-second").hide();
        }
        if ($("#control-auction")) {
            $("#control-auction").show();
        }
        
        veh_index(total_autos);
        
        // Reset the time back to 10s
        socket.send(JSON.stringify({
            type: "TIME",
            data: `10s`
        }));
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
    formFloorPriceButtons();
});



/**
    Add extra time button
 */
$("#add-second").on("click", function(){
    if (socket.readyState != WebSocket.OPEN){
        errorDisplay("Websocket is not connected, cannot do anything", true);
        return;
    }
    // Not Stoping the timer just means ignoring the ADDSECS.
    if (!stopTimer){
        return;
    }
    $("#timelefttobid").removeClass("last-time");
    stopTimer = false;
    is_bidding = true;
    let timeleft = parseInt($(this).val());
    socket.send(JSON.stringify({
        type: "TIME",
        data: `${timeleft}s`
    }));
    pause_resume_Auction("resume");
});

/**
    Raise last time for bid
 */
$("#last-second").on("click", function() {
    if (socket.readyState != WebSocket.OPEN){
        errorDisplay("Websocket is not connected, cannot do anything", true);
        return;
    }
    if (!is_bidding){
        errorDisplay("The auction is not running, cannot send this request");
        return;
    }
    stopTimer = false;
    socket.send(JSON.stringify({
        type: "LASTTIME",
        data: "10s"
    }));
    pause_resume_Auction("resume");
});



const CTRL_BUTTON_HANDLER = { default: () => errorDisplay("Unknow button", true) };
function addButtonHandler(name, fn){
    CTRL_BUTTON_HANDLER[name] = fn;
}
function performButtonHandler(name, ...args){
    const handler = CTRL_BUTTON_HANDLER[name];
    if (handler){
        return handler(...args);
    }
    return CTRL_BUTTON_HANDLER["default"];
}
$("#control-auction").on("click", function(){
    if (socket.readyState != WebSocket.OPEN){
        errorDisplay("Websocket is not connected, cannot do anything", true);
        return;
    }
    performButtonHandler($("#control-auction").text());
});
$(".decision-buttons").each(function(){
    $(this).on("click", function(){
        
        if (socket.readyState != WebSocket.OPEN){
            errorDisplay("Websocket is not connected, cannot do anything", true);
            return;
        }
        
        if (!stopTimer) {
            return;
        }
        performButtonHandler("DECISION", $(this).attr("id"), $(this).text());
    });
});

addButtonHandler("START", () => {
    $.ajax({
        url: `${BASE_URL}/createauctionsession`,
        timeout: 2000,
        method: "POST",
        dataType: "json",
        headers: {
            'X-CSRF-TOKEN': $('meta[name="csrf-token"]').attr('content')
        },
        data: { 
            "auctionitemid": selected_tableitem.attr("id"),
            "floor_price": parseMonetaryFormat($(".floor-price", selected_tableitem).text())
        },
        async: false,
        before: function(){
            showLoading();
        },
        error: function(jqXHR, textStatus, errorThrown){
            let response = jqXHR.responseJSON;
            errorDisplay(response["message"], false);
            hideLoading();
        },
        success: function(response, textStatus, jqXHR){
            successDisplay(response["message"], false);
            hideLoading();
        }
    });
});

addButtonHandler("DECISION", (decision, decision_text) => { 
    $.ajax({
        url: `${BASE_URL}/recordauctionsession`,
        timeout: 2000,
        method: "POST",
        dataType: "json",
        headers: {
            'X-CSRF-TOKEN': $('meta[name="csrf-token"]').attr('content')
        },
        data: { 
            "auctionitemid": selected_tableitem.attr("id"),
            "decision": decision
        },
        async: false,
        before: function(){
            showLoading();
        },
        error: function(jqXHR, textStatus, errorThrown){
            let response = jqXHR.responseJSON;
            errorDisplay(response["message"], false);
            hideLoading();
        },
        success: function(response, textStatus, jqXHR){
            hideLoading();
            response["decision"] = decision_text;
            socket.send(JSON.stringify({
                type: "FINISH",
                data: response
            }));
        }
    });
});

