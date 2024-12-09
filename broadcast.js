
import { WebSocketServer } from "ws";
import {parse} from "url";
import Redis from "ioredis";
import { WS_Record } from "./ws_record.js";
//import { get_cookies } from "./laravel_interface.js";


const redis_auth = new Redis({
  port: 6379,
  host: "127.0.0.1",
  db: 1,
  username: "root",
  password: "*******",
  keyPrefix: "lams:"
});
const redis_auction_ctrl = new Redis({
  port: 6379,
  host: "127.0.0.1",
  db: 0,
  username: "root",
  password: "********",
  keyPrefix: "lams:"
});
const wss = new WebSocketServer({ 
  port: 8080, 
  host: "updateprice.test",
  clientTracking: true
});

console.log("Broadcaster is running");

/**
 * TIMER
 * 
 * Every second, send a signal to all admins, and the admins will send back a signal to update the time.
 * Pausing the clock means ignoring this signal.
 * 
 * ADMIN_WS is array admins' websocket.
 *
 * NOTE: This mechanics is slightly cumbersome.
 * This timer is a centralized clock and only send signal to admins, then admins will broadcast the number of 
 * seconds left to bid to the rest of the bidders.
 */
const ADMIN_WS = new WS_Record(redis_auction_ctrl);
setInterval(function(){
  ADMIN_WS.tick();
}, 1000);


wss.on("connection", function connection(ws, request) {
  
  /**
   * Authentication on handshake with ws_otp
   * 
   * Format of ws_otp key in Redis  "'ws_otp':idauction:biddertype:bidderid"
   */
  
  ws.IS_ADMIN = false;
  const parameters = parse(request.url, true).query;
  
  
  // Parsing cookies
  let cookies = null;
  try {
    cookies = request.headers.cookie.split(';').reduce((cookies, cookie) => {
      const [name, value] = cookie.split('=').map(c => c.trim());
      cookies[name] = value;
      return cookies;
    }, {});
  }
  catch (error) {
    console.log("Fail to get the cookie, terminating");
    ws.terminate(); // Disconnect the socket immediately because it is from a stranger
    return;
  }
  
  // Retrieving credentials
  const ws_otp = cookies.ws_otp;
  ws.CHANNEL = parameters.channel;
  redis_auth.get(`ws_otp:${parameters.idauction}:${parameters.biddertype}:${parameters.bidderid}`, (err, result) => {
    if (err || ws_otp != result){
      console.log("Authentication fail");
      ws.terminate(); // Disconnect the socket immediately because it is from a stranger
      return;
    }
    // Must delete the key after auth because it may be used again which is prohibited.
    if (parameters.biddertype == "Admin"){
      ws.IS_ADMIN = true;
      ADMIN_WS.add(ws.CHANNEL, ws);
    }
    redis_auth.del(`ws_otp:${parameters.idauction}:${parameters.biddertype}:${parameters.bidderid}`);
  });
  
  /**
   * REDIS SUBSCRIPTION
   *
   * Subcribe to a correct channel in Redis to listen to
   * any changes in the bid price.
   */
  const redisListener = new Redis();
  redisListener.subscribe(ws.CHANNEL, (err, count) => {
    if (err){ 
      console.error(err.message); 
    }
  });
  redisListener.on("message", (channel, message) => {
    if (channel == ws.CHANNEL){
      ws.send(message);
    }
  });
  
  
  /**
   * SOCKET EVENTS
   * 
   * Receive the direct message from the admin to PAUSE or RESUME the auction.
   * Only admin is allowed to broadcast, others simply passively listen.
   * 
   * message = {
   *   type: [
   *     TIME = "The remaining amount of time of a sesison",
   *     TICK = "Announce one second just passes to all in-charge admins of each channel",
   *     BIDPRICE = "The amount of price that a bidder want to bid",
   *     START = "Announce the session is created and the bidders can start bidding",
   *     LASTTIME = "Announce the last chance to bid",
   *     NEWITEM = "Admin broadcasts this with an id to change the item he/she wants to bid"
   *   data: .............
   * }
   */
  ws.on("message", (message, isBinary) => {
    let data = JSON.parse(message);
    if (!ws.IS_ADMIN || data["type"] == "BIDPRICE"){
      return;
    }
    if (data["type"] == "NEWITEM"){
      ADMIN_WS.newitem(data, ws.CHANNEL);
    }
    redis_auth.publish(ws.CHANNEL, message);
  });
  
  
  ws.on("close", (code, buffer)=> {
    if (ws.IS_ADMIN){
      // If an admin disconnects, we need to remove them on the list of
      // ws that receive the emitting signal of TIMER.
      ADMIN_WS.del(ws.CHANNEL, ws);
    }
    redisListener.unsubscribe(ws.CHANNEL);
  });
  
});

