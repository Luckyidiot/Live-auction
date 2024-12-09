@extends('layouts.default')

@section('header')
<link rel="stylesheet" href="{{ url('/') }}/css/live-auction.css">
<meta name="csrf-token" content="{{ csrf_token() }}">
<meta name="bidderid" content="{{ $bidderid }}">
<meta name="biddertype" content="{{ $biddertype }}">
@endsection

@section("content")
<section class="ftco-section bg-light" style="padding-top: 50px;">
    <h2 class="title">{{$auction["auction_name"]}}</h2>
    <div class="container row inner-space">
        
        <div class="col-md-6" id="car-display">
            <div class="row">
                <div class="col-md-12">
                    <div id="custCarousel" class="carousel slide" data-bs-ride="carousel">
                        <div class="row top-bar-info" id="top-bar-info"></div>
                        <div id="info-table"></div>
                        
                        <!-- slides -->
                        <div class="carousel-inner" id="display-images"></div>
                        <!-- Left right -->
                        <a class="carousel-control-prev" href="#custCarousel" data-slide="prev">
                            <span class="carousel-control-prev-icon"></span>
                        </a>
                        <a class="carousel-control-next" href="#custCarousel" data-slide="next">
                            <span class="carousel-control-next-icon"></span>
                        </a>

                        <!-- Thumbnails -->
                        <ol class="carousel-indicators list-inline" id="list-images"></ol>
                    </div>
                </div>
            </div>
            
            <div class="table-list">
                
                @foreach ($autos as $index => $auto)
                    <div class="table-item row" id="{{ $auto['idauction_item'] }}">
                        <div class="col-md-2">
                            <img src="{{$auto['mainImage']}}" alt="Not found"  class="w-100 main-img"/>
                            
                            @foreach ($auto["images"] as $imgurl)
                            <img src="{{$imgurl}}" alt=""  class="pending-imgs" hidden/>
                            @endforeach
                            
                        </div>
                        <div class="col-md-10 pl-0 pr-0">
                            <div class="row h-25-px">
                                <div class="col-md-4">
                                    <h6 class="car-name">{{$auto['veh_year']}} {{$auto['veh_make']}} {{$auto['veh_model']}} {{$auto['veh_trim']}} </h6>
                                </div>
                                <div class="col-md-5">
                                    <div class="float-left d-flex"><p>Stock #: ${{$auto["stocknumber"]}}</p></div>
                                </div>
                                <div class="col-md-3">
                                    <div class="float-right d-flex"><p class="floor-price">${{$auto["floor_price"]}}</p></div>
                                </div>
                            </div>
                            <div class="row h-25-px">
                                <div class="col-md-4">
                                    <p>Brand: {{$auto["vehicle_branding"]}}</p>
                                </div>
                                <div class="col-md-4">
                                    <div class="float-left d-flex"><p>Location: No idea</p></div>
                                </div>
                                <div class="col-md-4">
                                    <div class="float-right d-flex"><p>Item: {{$index + 1}}</p></div>
                                </div>
                            </div>
                            <div class="row h-25-px">
                                <div class="col-md-6">
                                    <p>Odo: {{$auto['mileage']}}</p>
                                </div>
                                <div class="col-md-6">
                                    <div class="float-right d-flex"><i class="fa fa-solid fa-star"></i></div>
                                </div>
                            </div>
                        </div>
                        
                        <div style="display:hidden">
                            <meta name="veh_year" content="{{ $auto['veh_year'] }}">
                            <meta name="veh_make" content="{{ $auto['veh_make'] }}">
                            <meta name="veh_model" content="{{ $auto['veh_model'] }}">
                            <meta name="trim" content="{{ $auto['trim'] }}">
                            <meta name="VIN" content="{{ $auto['VIN'] }}">
                            <meta name="mileage" content="{{ $auto['mileage'] }}">
                            <meta name="vehicle_transmission" content="{{ $auto['vehicle_transmission'] }}">
                            <meta name="vehicle_engine" content="{{ $auto['vehicle_engine'] }}">
                            <meta name="vehicle_branding" content="{{ $auto['vehicle_branding'] }}">
                            <meta name="status" content="{{ $auto['status'] }}">
                            <meta name="stocknumber" content="{{ $auto['stocknumber'] }}">
                            <meta name="Key" content="No idea">
                            <meta name="Run&Drive" content="No idea">
                            <meta name="Location" content="No idea">
                        </div>
                    </div>
                @endforeach
                
            
            </div>
        </div>
        <!-- PRICE -->
        <div class="col-md-6 row">
            <div>
                <div class="top-bar-info" id="veh-counter">
                    Vehicle <span></span>/{{$total_autos}}
                </div>
                <div id="bid-record">
                    <div class="row" id="title">
                        <div class="col-md-2">Order</div>
                        <div class="col-md-6">Bidder</div>
                        <div class="col-md-4">Amount</div>
                    </div>
                    
                </div>
                <div id="session-result" style="display: none;">
                </div>
                
                <div class="d-flex alert alert-danger position-absolute start-50 translate-middle message" role="alert" id="error-message"></div>
                <div class="d-flex alert alert-success position-absolute start-50 translate-middle message" role="alert" id="success-message"></div>
                
                <div class="col-md-12 mt-3 d-flex justify-content-between">
                    <div class="form-group">
                        <label for="highestbid" class="col-sm-11">
                            <span class="h6 small bg-white text-muted">Highest bid</span> 
                        </label>
                        <input type="text" class="form-control mt-n4" id="highestbid" value="" readonly>
                    </div>
                    <div class="form-group">
                        <label for="timelefttobid" class="col-sm-11">
                            <span class="h6 small bg-white text-muted">Time left to bid</span> 
                        </label>
                        <input type="text" class="form-control mt-n4" id="timelefttobid" value="10s" readonly>
                    </div>
                </div>
                <div class="col-md-12 mt-2 d-flex justify-content-between">
                    @if(Session::get('is_admin', null))
                        <button type="button" class="btn btn-setting rounded-10 w-30 move-button" id="move_prev" value="Move Prev">Move Prev</button>
                        <button type="button" class="btn btn-setting rounded-10 w-30 move-button" id="move_next" value="Move Next">Move Next</button>
                        <button type="button" class="btn btn-setting rounded-10 w-10" id="add-second" value="10" style="display: none;">+ 10S</button>
                        <button type="button" class="btn btn-primary rounded-10" id="control-auction" value="START">START</button>
                        <button type="button" class="btn btn-setting rounded-10 w-20" id="last-second" value="Last 10S">Last 10S</button>
                    @else
                        <button type="button" class="btn btn-info rounded-10 w-20 bid-button" value="{{(count($price_buttons) > 0)? $price_buttons[0] : '0'}}">$4,100</button>
                        <button type="button" class="btn btn-info rounded-10 w-20 bid-button" value="{{(count($price_buttons) > 1)? $price_buttons[1] : '0'}}">$4,200</button>
                        <button type="button" class="btn btn-info rounded-10 w-20 bid-button" value="{{(count($price_buttons) > 2)? $price_buttons[2] : '0'}}">$4,500</button>
                        <button type="button" class="btn btn-info rounded-10 w-20 bid-button" value="{{(count($price_buttons) > 3)? $price_buttons[3] : '0'}}">$5,000</button>
                    @endif
                </div>
                @if(Session::get('is_admin', null))
                {{-- Fake bid buttons --}}
                
                <div class="row col-md-12 mt-2 mx-auto">
                    <div class="col-md-6 admin-bid-left p-1">
                        <div class="d-flex justify-content-between m-3">
                            <select class="rounded-10">
                                <option value="">InHouse ID</option>
                                @foreach ($inhouse_numbers as $id)
                                <option value="{{$id}}">{{$id}}</option>
                                @endforeach
                            </select>
                            <button type="button" value="{{(count($price_buttons) > 0)? $price_buttons[0] : '0'}}" class="btn btn-warning rounded-10 bid-button">$4100</button>
                        </div>
                        <div class="d-flex justify-content-between m-3">
                            <select class="rounded-10">
                                <option value="">InHouse ID</option>
                                @foreach ($inhouse_numbers as $id)
                                <option value="{{$id}}">{{$id}}</option>
                                @endforeach
                            </select>
                            <button type="button" value="{{(count($price_buttons) > 1)? $price_buttons[1] : '0'}}" class="btn btn-warning rounded-10 bid-button">$4600</button>
                        </div>
                    </div>
                    <div class="col-md-6 admin-bid-right p-1">
                        <div class="d-flex justify-content-between m-3">
                            <select class="rounded-10">
                                <option value="">InHouse ID</option>
                                @foreach ($inhouse_numbers as $id)
                                <option value="{{$id}}">{{$id}}</option>
                                @endforeach
                            </select>
                            <button type="button" value="{{(count($price_buttons) > 2)? $price_buttons[2] : '0'}}" class="btn btn-warning rounded-10 bid-button">$4100</button>
                        </div>
                        <div class="d-flex justify-content-between m-3">
                            <select class="rounded-10">
                                <option value="">InHouse ID</option>
                                @foreach ($inhouse_numbers as $id)
                                <option value="{{$id}}">{{$id}}</option>
                                @endforeach
                            </select>
                            <button type="button" value="{{(count($price_buttons) > 3)? $price_buttons[3] : '0'}}" class="btn btn-warning rounded-10 bid-button">$4600</button>
                        </div>
                    </div>
                </div>
                
                
                <div class="d-flex justify-content-between mt-2 specific-area">
                    <select class="h-35-px rounded-10">
                        <option value="">InHouse ID</option>
                        @foreach ($inhouse_numbers as $id)
                        <option value="{{$id}}">{{$id}}</option>
                        @endforeach
                    </select>
                    <div class="form-group w-30">
                        <label for="specificbid" class="col-sm-11">
                            <span class="small bg-white text-muted">Specific Amount (CAD)</span> 
                        </label>
                        <input type="number" class="form-control mt-n4" id="specificbid" value="4000">
                    </div>
                    <button type="button" class="insert-specific-bid h-35-px" id="insert-bid">INSERT BID</button>
                </div>
                <div class="d-flex justify-content-start mt-2 floor-area">
                    <div class="form-group w-30 mr-5">
                        <label for="floorbid" class="col-sm-11">
                            <span class="small bg-white text-muted">Floor Bid (CAD)</span> 
                        </label>
                        <input type="number" class="form-control mt-n4" id="floorbid" value="">
                    </div>
                    <button type="button" value="{{(count($price_buttons) > 0)? $price_buttons[0] : '0'}}" id="floor-bid" class="insert-specific-bid h-35-px rounded-10">
                        Floor: <span id="inner-floorbid-value"></span>
                    </button>
                </div>
                
                <!--Bid decision-->
                <div class="col-md-12 row mt-2 bid-decision-area">
                    <b>Bid Decision</b>
                    <div class="d-flex justify-content-between bid-decision pt-2 pb-2">
                        @foreach ($decisionbuttons as $text => $id)
                        <button type="button" class="rounded-10 decision-buttons" id="{{ $id }}">{{ $text }}</button>
                        @endforeach
                    </div>
                </div>
                @else
                <div class="col-md-12 mt-2 d-flex justify-content-between">
                    <div class="full-input">
                        <label for="jumpbid">Jump Bid</label>
                        <input type="text" id="jumpbid" value="$ Amount">
                    </div>
                    
                    
                    <div class="full-input">
                        <label for="maximumbid">My maximum Bid</label>
                        <input type="text" id="maximumbid" value="$0">
                    </div>
                </div>
                @endif
            </div>
        </div>
    </div>
</section>
@endsection

@section('scripts')
    
    <script src="{{ url('/') }}/js/live-auction/live-auction.js"></script>
    <script>
        /**
            Have to do it here but not in a js file because we need to access some variables in php.
         */
        var total_autos = "{{$total_autos}}";
        var selected_tableitem = null;
        var is_bidding = false;
        if ("{{$is_jumpin}}"){
            var onbid_item = <?php echo json_encode($onbid_item); ?>;
            
            selected_tableitem = $(`.table-item#${onbid_item["id"]}`);
            selected_tableitem.addClass("table-item-selected");
            setCarousel();
            if (onbid_item.hasOwnProperty("data")){
                 /**
                The session is created and being bidded.
                */
                onbid_item["data"].forEach((data) => {
                    update_BidBoard(data[0], data[1], data[2], data[3]);
                });
                update_HighestBid(onbid_item["bidprice"]);
                is_bidding = true;

                if ($("#add-second")) {
                    $("#add-second").show();
                }
                if ($("#control-auction")) {
                    $("#control-auction").hide();
                }
            }
            else {
                // Session was not created, load as usual
                update_PriceBoard();
                formAutoPriceButtons();
            }
        }
        else{
            // Not a jumpin, so do as regular.
            selected_tableitem = $(".table-item").first();
            selected_tableitem.addClass("table-item-selected");
            setCarousel();
            update_PriceBoard();
            formAutoPriceButtons();
        }
        veh_index(total_autos);
        
    </script>
    @if ($biddertype == config("constants.Bidder_Type.Admin"))
        <script src="{{ url('/') }}/js/live-auction/live-auction-admin.js"></script>
        <script src="{{ url('/') }}/js/live-auction/live-auction-ctrl-admin.js"></script>
    @else
        <script src="{{ url('/') }}/js/live-auction/live-auction-user.js"></script>
        <script src="{{ url('/') }}/js/live-auction/live-auction-ctrl-user.js"></script>
    @endif
    <script>hideLoading();</script>

@endsection