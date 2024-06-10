import plugin from "../../lib/plugins/plugin.js";
import fs from 'node:fs'
import  { automuteList } from './config/config_automute.js';

console.log(automuteList);
let AutomuteList = JSON.parse(JSON.stringify(automuteList));

 
export class AutoBizui extends plugin {
    constructor(e) {
      super({
        name: "自动闭嘴",
        dsc: "自动闭嘴",
        event: "message.group",
        priority: 500,
        rule: [
              {
              reg: "^.*$",
              fnc: "CatchAllMessages",
              },
        ],
      });
    }

    async init(){
    }
  
    async CatchAllMessages(){
      if(!this.e.isGroup) return;
      console.log(this.e.group_id);
      for(const x of AutomuteList){
        if(x.groupId == this.e.group_id && x.uid == this.e.sender.user_id){
          if(!x.hasOwnProperty('duration')) x.duration = x.baseDuration;
          console.log(x.duration, x.prob);
          if(Math.random() > x.prob){
            x.duration *= 2;
            return true;
          }
          let now_duration = x.duration;
          this.e.group.muteMember(x.uid, now_duration * 60);
          x.duration = x.baseDuration;
        }
      }
    }
}