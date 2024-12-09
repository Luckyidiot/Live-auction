

function cacheBidPrice(price, bidtype){
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

/**
Manage buttons that increase the bid price
*/
$(".bid-button").each(function(){
    $(this).on("click", function(){
        if (socket.readyState == WebSocket.OPEN){
            let newPrice = parseMonetaryFormat($(this).text());
            // Update the price and reset the time field if it succeeds.
            console.log(newPrice);
            cacheBidPrice(newPrice, "Net bid");
            
            return;
        }
        else {
            errorDisplay("Socket is not listening, cannot bid.", false);
            return;
        }
    });
});

$("#jumpbid").on("focusout", function() {
    let jumpbid = parseMonetaryFormat($(this).val());
    let highestVal = parseMonetaryFormat($("#highestbid").val());

    if (isNaN(jumpbid)) {
        return;
    }

    if (jumpbid <= highestVal) {
        errorDisplay("Price is less or equal than highest bid, cannot bid.", false);
        return;
    }
    
    if (socket.readyState != WebSocket.OPEN) {
        errorDisplay("Socket is not listening, cannot bid.", false);
        return;
    }

    cacheBidPrice(jumpbid, "Net bid");
    return;

})



