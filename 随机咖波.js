import plugin from "../../lib/plugins/plugin.js";
import fs from 'node:fs'
import cfg from "../../lib/config/config.js";
import { segment } from "oicq";
import { extname } from "node:path";

const random_image_path = './data/random_image/';
const ext_images = {
  png: 1,
  jpg: 1,
  gif: 1,
  webp: 1,
}


let random_image_data = {}
fs.readdirSync(random_image_path).forEach(file => {
  if(fs.lstatSync(random_image_path + file).isDirectory()){
      let list_images = fs.readdirSync(random_image_path + file)
          .filter(fileName => extname(fileName).slice(1) in ext_images);
      if(list_images.length > 0){
        random_image_data[file] = list_images;
        console.log(`成功加载表情文件夹：${file}，共${list_images.length}个表情`);
      }
  }
});


export class random_capoos extends plugin {
    constructor(e) {
      super({
        name: "随机咖波",
        dsc: "随机咖波",
        event: "message.group",
        priority: 500,
        rule: [
              {
              reg: `^(#)?随机(${Object.keys(random_image_data).join("|")})$`,
              fnc: "randomImage",
              },
        ],
      });

      random_image_data = random_image_data
    }
  
    async randomImage(){
      const ImageSetName = this.e.msg.replace(/^(#)?随机/, "");
      if(random_image_data[ImageSetName]){
        let len = random_image_data[ImageSetName].length;
        const message = [
          segment.image(`${random_image_path}${ImageSetName}/${random_image_data[ImageSetName][Math.floor(Math.random()*len)]}`)
        ]
        this.e.reply(message);
      }
    }
}