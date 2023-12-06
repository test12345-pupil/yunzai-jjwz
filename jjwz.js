import plugin from "../../lib/plugins/plugin.js";
import fs from 'node:fs'
import { jjwz_Server } from "./lib/jjwz_server.js";
import cfg from "../../lib/config/config.js";


// 修改自 https://gitee.com/xianxincoder/xianxin-plugin/blob/master/apps/blackjack.js

// key:value形式，key=group_id
// value为一个数组，数组每个元素为
// {content: 内容, writer: 发送者, timer: Date.now(), 
// message_id: 发送者的消息id, reply_id: 回复的消息id}
// 当前文章数据
let jjwzArticles = {};

let jjwz_cd = 2; // second
const jjwz_cd2_key = "Yunzai:jjwz:jjwz_cd2";
let jjwz_cd2 = await redis.get(jjwz_cd2_key);
if(!jjwz_cd2) jjwz_cd2 = [-1, 1000000000, 120, 60, 30];
else jjwz_cd2 = jjwz_cd2.split(',').map(x=>Number(x));

const jjwz_save_path = './data/jjwz/';
const reg_valid_titles = /^[^/\\]*$/;

/*
例：jjwz_cd2 = [-1, 100000000, 40, 30, 20, 0]
意为：上次自己续写后
有1次续写，则需等待300s
有2次续写，则需等待150s
有3次续写，则需等待70s
有4次续写，则需等待30s
*/

 
export class jueJuWenZhang extends plugin {
    constructor(e) {
      super({
        name: "绝句文章",
        dsc: "绝句文章",
        event: "message.group",
        priority: 500,
        rule: [
              {
              reg: "^(#)?(jjwz|绝句文章)帮助$",
              fnc: "jjwzHelp",
              },
              {
              reg: "^(#)?查看文章$",
              fnc: "viewArticle",
              },
              {
              reg: "^((#)?(续写)|>).*$",
              fnc: "continueWriting",
              },
              {
              reg: "^(#)?完成文章.*$",
              fnc: "endAndEntitle",
              },
              {
              reg: "^(#)?修改cd.*$",
              fnc: "changeCD",
              permission: "master",
              },
              {
              reg: "^(#)?重置文章.*$",
              fnc: "resetArticle",
              },
        ],
      });
    }

    async init(){
      if (!fs.existsSync(jjwz_save_path)) {
        fs.mkdirSync(jjwz_save_path);
      }
      if(!this.server){
        this.server = new jjwz_Server(jjwz_save_path);
      }else this.server.close();
      this.server.listen(11451);
    }
  
    /** 群号key */
    get grpKey() {
      return `Yz:jjwzgroup_id:${this.e.user_id}`;
    }
  
    /**
     * rule - #绝句文章帮助
     * 如果emptyArticle不为null则返回“文章为空”
     * @param {number} emptyArticle 
     * @returns
     */
  
    async jjwzHelp(emptyArticle){
      await this.getGroupId();
      if (!this.group_id) return;
  
      if (!jjwzArticles[this.group_id]) jjwzArticles[this.group_id] = new Array();
  
      const message = ["绝句文章帮助",
          "\n#查看文章： 查看当前文章",
          `\n(#?续写|>)巨大多喝水： 包含至多5个字符，cd为${jjwz_cd}秒。可以撤回`,
          `\n  无法连续续写两次，若前面仅有[1-${jjwz_cd2.length-2}]次续写，则需等待至少[${jjwz_cd2.slice(2)}]秒`,
          "\n#完成文章 炄勺，砒： 题名并完成文章",
          emptyArticle === 1 ? "\n当前没有文章，可直接#续写" : ""];
  
      this.e.reply(message);
    }
  
    renderArticle(articleArray){
      return articleArray.map(x => x.content).join('');
    }
  
    /**
     * rule - #文章开头
     * @returns
     */
    async viewArticle() {
      await this.getGroupId();
      if (!this.group_id) return;
  
      if(jjwzArticles[this.group_id].length == 0){
          this.jjwzHelp(1);
          return;
      }
      const message = ["当前文章：" ,
       this.renderArticle(jjwzArticles[this.group_id])];
  
      this.e.reply(message);
    }
  
    /**
     * rule - #续写
     * @returns
     */
    async continueWriting() {
      await this.getGroupId();
      if (!this.group_id) return;
  
      const content = this.e.msg.replace(/^((#)?(续写)|>)/, "").trim();
  
      if(content.length > 5 || content.length == 0){
          return;
      }
  
      const writer = this.e.sender.user_id;
      const timer = Date.now();
  
      if(timer - jjwzArticles[this.group_id].global_timer < jjwz_cd * 1000) return;
      for(let i=1; i<jjwz_cd2.length && i<=jjwzArticles[this.group_id].length; ++i){
          if(jjwzArticles[this.group_id].at(-i).writer == writer &&
              timer - jjwzArticles[this.group_id].at(-i).timer < jjwz_cd2[i] * 1000) 
              return;
      }

      jjwzArticles[this.group_id].global_timer = timer;

      const sending = {content, writer, timer, message_id: this.e.message_id};
      const index = jjwzArticles[this.group_id].push(sending) - 1;

      const message = [this.renderArticle(jjwzArticles[this.group_id])];
      const reply = await this.e.reply(message, true);
  
      jjwzArticles[this.group_id][index].reply_id = reply.message_id;
    }
  
    async endAndEntitle(){
      await this.getGroupId();
      if (!this.group_id) return;
  
      if (jjwzArticles[this.group_id].length < 10 && this.renderArticle(jjwzArticles[this.group_id]).length < 30){
          this.e.reply(["文章太短了!"], true);
          return;
      }
  
      const title = this.e.msg.replace("#", "").replace("完成文章", "").trim();

      if(!title.match(reg_valid_titles)){
        this.e.reply(["标题不合法"], true);
        return;
      }

      if (!fs.existsSync(`${jjwz_save_path}${this.group_id}`)) {
        fs.mkdirSync(`${jjwz_save_path}${this.group_id}`);
      }

      const file_location = `${jjwz_save_path}${this.group_id}/${title}.txt`;

      if(fs.existsSync(file_location)){
        this.e.reply(["该标题已经存在一篇文章，请换一个"], true);
        return;
      }
  
      const message = ["《"+title+"》\n",
          this.renderArticle(jjwzArticles[this.group_id])];
  
      fs.writeFileSync(file_location, this.renderArticle(jjwzArticles[this.group_id]));

      this.e.reply(message, true);

      jjwzArticles[this.group_id] = new Array();
    }
  
    /** 获取群号 */
    async getGroupId() {
      if (this.e.isGroup) {
          this.group_id = this.e.group_id;
          if (!jjwzArticles[this.group_id]){
            jjwzArticles[this.group_id] = new Array();
            jjwzArticles[this.group_id].global_timer = -1;
          }
          return this.group_id;
      }

      let groupId = await redis.get(this.grpKey);
      if (groupId) {
        this.group_id = groupId;
        if (!jjwzArticles[this.group_id]){
          jjwzArticles[this.group_id] = new Array();
          jjwzArticles[this.group_id].global_timer = -1;
        }
        return this.group_id;
      }
  
      return;
    }

    async changeCD(){
      const new_cdstring = this.e.msg.replace("#", "").replace("修改cd", "").trim();
      try{
        jjwz_cd2 = [-1,1000000000].concat(new_cdstring.split(',').map(x=>Number(x)));
        this.e.reply([`成功修改cd：`, String(jjwz_cd2.slice(2))], true);
        redis.setEx(jjwz_cd2_key, 3600 * 24 * 30, String(jjwz_cd2));
      }catch(e){
      }
    }

    async resetArticle(){
      await this.getGroupId();
      if (!this.group_id) return;

      if (this.e.member.user_id != cfg.masterQQ && !this.e.member.is_owner && !this.e.member.is_admin && !this.e.group.is_owner && !this.e.group.is_admin) {
        this.e.reply('重置失败，只有主人与管理员能操作', true);
        return false;
      }
  
      const content = this.e.msg.replace(/^(#)?重置文章/, "");
  
      jjwzArticles[this.group_id] = new Array();
  
      jjwzArticles[this.group_id].push({
        content,
        writer: 'admin',
        timer: Date.now(),
        message_id: 'undefined',
        reply_id: 'undefined',
      });
      const message = [this.renderArticle(jjwzArticles[this.group_id])];
  
      this.e.reply(message, true);
    }
}


export class jueJuWenZhangRecall extends plugin {
  constructor(e) {
    super({
      name: "绝句文章",
      dsc: "绝句文章撤回",
      event: "notice.group.recall",
      priority: 500,
      rule: [
            {
            reg: "^.*$",
            fnc: "jjwzRecall",
            },
      ],
    });
  }

  async jjwzRecall(){
    
    await this.getGroupId();
    if (!this.group_id) return;

    if(jjwzArticles[this.group_id].length == 0) return;

    const msg_id = this.e.message_id;

    if(jjwzArticles[this.group_id].length > 0 && jjwzArticles[this.group_id].at(-1).message_id === msg_id){
      jjwzArticles[this.group_id].global_timer = Date.now();
      if(await this.e.group.recallMsg(jjwzArticles[this.group_id].at(-1).reply_id)){
        jjwzArticles[this.group_id].pop()
      }
    }

    return;
  }

  /** 群号key */
  get grpKey() {
    return `Yz:jjwzgroup_id:${this.e.user_id}`;
  }
  
    /** 获取群号 */
    async getGroupId() {
      if (this.e.isGroup) {
          this.group_id = this.e.group_id;
          if (!jjwzArticles[this.group_id]){
            jjwzArticles[this.group_id] = new Array();
            jjwzArticles[this.group_id].global_timer = -1;
          }
          return this.group_id;
      }

      let groupId = await redis.get(this.grpKey);
      if (groupId) {
        this.group_id = groupId;
        if (!jjwzArticles[this.group_id]){
          jjwzArticles[this.group_id] = new Array();
          jjwzArticles[this.group_id].global_timer = -1;
        }
        return this.group_id;
      }
  
      return;
    }
}