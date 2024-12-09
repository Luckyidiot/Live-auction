export class WS_Record{
    constructor(auction_ctrl){
        /**
         * format of _record
         * channel => Set()
         */
        this._record = new Map();
        this._redis = auction_ctrl;
    }
    
    add(key, value){
        let listOf_admins = this._record.get(key);
        if (this._record.has(key) && (listOf_admins instanceof Set)){
            // This channel already exist, so add more to it.
            listOf_admins.add(value);
            return true;
        }
        if (!this._record.has(key) || !(listOf_admins instanceof Set)){
            // This channel either does not exist or has a problem.
            this._record.set(key, new Set([value]));
            return true;
        }
        return false;
    }
    
    del(key, value){
        if (this._record.has(key)){
            let listOf_admins = this._record.get(key); //Set()
            if (listOf_admins.has(value)){
                listOf_admins.delete(value);
            }
            
            if (listOf_admins.size == 0){
                // There is no more admin in the auction room
                this._record.delete(key);
                this._pause_auction(key);
            }
            return true;
        }
        return false;
    }
    
    tick(){
        this._record.forEach((listOf_admins, channel) => {
            let admin_ws = listOf_admins.values().next().value;
            admin_ws.send(JSON.stringify({
                type: "TICK"
            }));
        });
    }
    
    async newitem(data, channel){
        channel = channel.split(":");
        channel.shift();
        channel = channel.join("");
        
        const is_exists = await this._redis.hexists(`${channel}`, "onbid");
        if (!is_exists){
            return;
        }
        /*
        if (data["is_finish"]){
            let listOf_itemid = await this._redis.hget(`${channel}`, "items");
            listOf_itemid = listOf_itemid.split(",").filter(itemid == data["itemid"]);
            listOf_itemid = listOf_itemid.join(",");
            this._redis.hset(`${channel}`, {"items": `${listOf_itemid}`});
        }
        */
        this._redis.hset(`${channel}`, {"onbid": `${data["itemid"]}`});
    }
    
    
    async _pause_auction(channel){
        // Pause the auction when there is no admins left in the room.
        channel = channel.split(":");
        channel.shift();
        channel = channel.join("");
        
        const onbid_sessionID = await this._redis.hget(`${channel}`, "onbid");
        this._redis.hexists(`${channel}:${onbid_sessionID}`, "status", (err, is_exists) => {
            if (!is_exists){
                return;
            }
            this._redis.hset(`${channel}:${onbid_sessionID}`, {"status": "PAUSED"});
        });
    }
    
    _show_record(){
        this._record.forEach((listOf_admins, channel) => {
            console.log(`${channel} has ${listOf_admins.size} instances`);
        });
    }
}