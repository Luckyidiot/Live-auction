


const BASE_URL = $(location).attr("origin");
const bidderid = $('meta[name="bidderid"]').attr('content');
const biddertype = $('meta[name="biddertype"]').attr('content');
const auctionID = $(location).attr('href').slice(-1);
const WS_URL = `ws://${$(location).attr('hostname')}/updateprice/?channel=lams:${auctionID}&idauction=${auctionID}&bidderid=${bidderid}&biddertype=${biddertype}`;


const socket = new WebSocket(WS_URL);
socket.addEventListener("open", function(){
    // Render some kind of message to the screen
    successDisplay("Connected to broadcast, ready for auction", false);
});
socket.addEventListener("close", function(){
    // Render some kind of message to the screen
    errorDisplay("Broadcast connection was interrupted, reload the page", true);
});
socket.addEventListener("error", function(){
    errorDisplay("Unable to connect to the broadcaster, please reload", true);
});
$(window).on('beforeunload', function() {
    socket.close();
});

/**
 * 
 * Common functions that both admins and regular users share
 */

function errorDisplay(message, is_persist){
    $("#error-message").text(message);
    $("#error-message").css("visibility", "visible");
    
    if (is_persist){
        return;
    }
    setTimeout(function(){
        $("#error-message").css("visibility", "hidden");
    }, 1000);
}

function successDisplay(message, is_persist){
    $("#success-message").text(message);
    $("#success-message").css("visibility", "visible");
    
    if (is_persist){
        return;
    }
    setTimeout(function(){
        $("#success-message").css("visibility", "hidden");
    }, 1000);
}


function parseMonetaryFormat(money){
    let num_money = money.replace("$", "").replace(/,/g, "");
    return parseFloat(num_money);
}
function formatMoney(money){
    /**
        Add the dollar sign at the front and separate every three digits with a comma.
        */
    if (money.length <= 3){
        return "$" + money;
    }
    
    money = money.split(".");
    let moneyLength = money[0].length;
    for (let i = 1; i <= moneyLength/3; i++){
        let index = moneyLength - i * 3;
        money[0] = money[0].slice(0, index) + "," + money[0].slice(index);
    }
    
    money = "$" + money.join(".");
    return money;
}

function formAutoPriceButtons(){
    let highest_bid = parseMonetaryFormat($("#highestbid").val());
    $(".bid-button").each(function(){
        let auto_money = highest_bid + parseInt($(this).attr("value"));
        $(this).text(formatMoney(auto_money.toString()));
    });
}

function update_PriceBoard(){
    var floor_price = $(".floor-price", selected_tableitem).text();
    $("#highestbid").val(floor_price);
}

function setCarousel(){
    $("#display-images").empty();
    $("#list-images").empty();
    let num = 1;
    let mainImg = `
        <div class="carousel-item active">
            <img class="d-block mx-auto w-100" src=${$(".main-img", selected_tableitem).attr("src")} alt="Not found">
        </div>
    `;
    let mainThumbnail = `
        <li class="list-inline-item active">
            <a id="carousel-selector-0" class="selected" data-slide-to="0" data-target="#custCarousel">
            <img src=${$(".main-img", selected_tableitem).attr("src")} class="img-fluid">
            </a>
        </li>
    `;
    
    $("#display-images").append(mainImg);
    $("#list-images").append(mainThumbnail);
    
    $(".pending-imgs", selected_tableitem).each(function(){
        let img = `
            <div class="carousel-item">
                <img class="d-block mx-auto w-100" src=${$(this).attr("src")} alt="Not found">
            </div>
        `;
        let thumbnail = `
            <li class="list-inline-item">
                <a id="carousel-selector-${num}" class="selected" data-slide-to="${num}" data-target="#custCarousel">
                <img src=${$(this).attr("src")} class="img-fluid">
                </a>
            </li>
        `;
        $("#display-images").append(img);
        $("#list-images").append(thumbnail);
        num += 1;
    });
    
    // Set the info table
    $("#top-bar-info").empty();
    $("#info-table").empty();
    
    let top_bar_info = `
        <div class="col-lg-3">Lane 1</div>
        <div class="text-end col-lg-9">${$("meta[name='veh_year']", selected_tableitem).attr("content")} ${$("meta[name='veh_make']", selected_tableitem).attr("content")} ${$("meta[name='veh_model']", selected_tableitem).attr("content")} | Stock # ${$("meta[name='stocknumber']", selected_tableitem).attr("content")}</div>
    `;
    let info_table = `
        <div class="row">
            <div class="col-lg-4">Year: ${$("meta[name='veh_year']", selected_tableitem).attr("content")}</div>
            <div class="col-lg-4">Trans: ${$("meta[name='vehicle_transmission']", selected_tableitem).attr("content")}</div>
            <div class="col-lg-4"><img class="img-logo-info-table" src="${BASE_URL}/images/softful_logo.png"></div>
        </div>
        <div class="row">
            <div class="col-lg-4">Make: ${$("meta[name='veh_make']", selected_tableitem).attr("content")}</div>
            <div class="col-lg-4">Engine: ${$("meta[name='vehicle_engine']", selected_tableitem).attr("content")}</div>
        </div>
        <div class="row">
            <div class="col-lg-4">Model: ${$("meta[name='veh_model']", selected_tableitem).attr("content")}</div>
            <div class="col-lg-4">Key: ${$("meta[name='Key']", selected_tableitem).attr("content")}</div>
            <div class="col-lg-4">Run & Drive: ${$("meta[name='Run&Drive']", selected_tableitem).attr("content")}</div>
        </div>
        <div class="row">
            <div class="col-lg-4">Trim: ${$("meta[name='trim']", selected_tableitem).attr("content")}</div>
            <div class="col-lg-4">Location: ${$("meta[name='Location']", selected_tableitem).attr("content")}</div>
        </div>
        <div class="row">
            <div class="col-lg-4">VIN: ${$("meta[name='VIN']", selected_tableitem).attr("content")}</div>
            <div class="col-lg-4">Brand: ${$("meta[name='vehicle_branding']", selected_tableitem).attr("content")}</div>
        </div>
        <div class="row">
            <div class="col-lg-4">Mileage: ${$("meta[name='mileage']", selected_tableitem).attr("content")}</div>
            <div class="col-lg-4">Damage: ${$("meta[name='status']", selected_tableitem).attr("content")}</div>
        </div>
    `;
    $("#top-bar-info").append(top_bar_info);
    $("#info-table").append(info_table);
    
}

function update_HighestBid(highest_bid, callback=null){
    highest_bid = formatMoney(highest_bid);
    $("#highestbid").val(highest_bid);
    formAutoPriceButtons();
    
    if (callback){
        //Floor price button
        callback();
    }
}

function update_BidBoard(bidtype, bidderid, bidorder, amount){
    let bidrow = `
        <div class="row record-row">
            <div class="col-md-2 bid-info order">${bidorder}</div>
            <div class="col-md-6 bid-info">${bidtype} (ID: ${bidderid})</div>
            <div class="col-md-4 bid-info">${formatMoney(amount)}</div>
        </div>
    `;
    $("#bid-record").append(bidrow);
}

function show_result(id, bidtype, money, decision, is_done){
    $("#bid-record").hide();
    
    let session_result = `
        Bidder ${id} (${bidtype}) won with ${money}
        <br>
        Decision: ${decision}
    `;
    if (is_done){
        session_result = `${session_result}
            <br>
            This is the last item. Auction will be closed soon. See you later.
        `;
    }
    
    $("#session-result").append(session_result);
    $("#session-result").show();
}

function veh_index(total){
    let index = total - $(".table-item").length + 1;
    $("#veh-counter span").text(index);
}


