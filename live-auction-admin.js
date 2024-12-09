

var stopTimer = true;
var is_finish = false;

function cacheBidPrice(price, bidtype, inHouseID){
    // This function of the admin is different from that of the regular user.
    $.ajax({
        url: `${BASE_URL}/cachenewprice`,
        timeout: 1000,
        method: "PATCH",
        dataType: "json",
        headers: {
            'X-CSRF-TOKEN': $('meta[name="csrf-token"]').attr('content')
        },
        data: { 
            "bidprice": price,
            "auctionitemid": selected_tableitem.attr("id"),
            "bidtype": bidtype,
            "inHouseID": inHouseID
        },
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
        }
    });
}
function pause_resume_Auction(action){
    // action is either "pause" or "resume"
    $.ajax({
        url: `${BASE_URL}/${action}`,
        timeout: 1000,
        method: "PATCH",
        dataType: "json",
        headers: {
            'X-CSRF-TOKEN': $('meta[name="csrf-token"]').attr('content')
        },
        async: false,
        data: {
            "auctionitemid": selected_tableitem.attr("id")
        },
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
        }
    });
}

function formFloorPriceButtons(){
    let highest_bid = parseMonetaryFormat($("#highestbid").val());
    let auto_money = highest_bid + parseInt($("#floor-bid").val());
    $("#inner-floorbid-value").text(`${formatMoney(auto_money.toString())}`);
}
formFloorPriceButtons();


/**
    Behavior of move buttons
*/
$(".move-button").each(function(){
    
    $(this).on("click", function(){
        if (is_bidding){
            errorDisplay("A session is going on, cannot move on another item.");
            return;
        }
        let arrayOf_cars = $(".table-item");
        var item_id = null;
        
        for (let index = 0; index < arrayOf_cars.length; index++){
            if (selected_tableitem[0] == arrayOf_cars[index]){
            
                if ($(this).attr("id") == "move_next"){
                    // Move next
                    if (index + 1 == arrayOf_cars.length){
                        // At the end of the list, so cannot move next
                        return;
                    }
                    item_id = arrayOf_cars.eq(index + 1).attr("id");
                    break;
                }
                else {
                    // Move prev
                    if (index == 0){
                        // At the beginning of the list, so cannot move prev
                        return;
                    }
                    item_id = arrayOf_cars.eq(index - 1).attr("id");
                    break;
                }
            }
        }
        
        if (item_id) {
            socket.send(JSON.stringify({
                type: "NEWITEM",
                is_finish: is_finish,
                itemid: item_id
            }));
            if (is_finish){
                is_finish = false;
            }
        }
    });
});


/**
Manage buttons that increase the bid price
*/
$(".bid-button").each(function(){
    $(this).on("click", function(){
        let inhouseID = $(this).siblings("select").val();
    
        if (socket.readyState == WebSocket.OPEN && inhouseID != ""){
            let newPrice = parseMonetaryFormat($(this).text());
            
            // Update the price and reset the time field if it succeeds.
            cacheBidPrice(newPrice, "Net bid", inhouseID);
            return;
        }
        else {
            errorDisplay("Error, cannot bid.", false);
            return;
        }
    });
});

$("#insert-bid").on("click", function(){
    let inhouseID = $(this).siblings("select").val();
    if (socket.readyState == WebSocket.OPEN && inhouseID != ""){
        let newPrice = parseMonetaryFormat($("#specificbid").val());
        // Update the price and reset the time field if it succeeds.
        cacheBidPrice(newPrice, "Net bid", inhouseID);
        return;
    }
    else {
        errorDisplay("Error, cannot bid.", false);
        return;
    }
});

/**
 * Floor bid button
 */
$("#floor-bid").on("click", function(){
    
    let manual_price = parseMonetaryFormat($("#floorbid").val());
    if (socket.readyState == WebSocket.OPEN){
        // Update the price and reset the time field if it succeeds.
        if (manual_price){
            cacheBidPrice(manual_price, "Floor bid", 0);
            return;
        }
        manual_price = parseMonetaryFormat($("#inner-floorbid-value").text());
        cacheBidPrice(manual_price, "Floor bid", 0);
        return;
    }
    else {
        errorDisplay("Error, cannot bid.", false);
        return;
    }
});







