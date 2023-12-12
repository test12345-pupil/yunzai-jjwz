import { lstat, readFileSync, readdir, statSync } from 'node:fs';
import { createServer } from 'http';
import { basename, extname, join } from "node:path";
import crypto from "crypto"
import { jjwz_listenport, jjwz_server_refresh_time } from '../config/config.js';
import cfg from "../../../lib/config/config.js";


export class jjwz_Server{
  escapeHTML(str){
    return str.replace(/[&<>'"]/g, 
      tag => ({
          '&': '&amp;',
          '<': '&lt;',
          '>': '&gt;',
          "'": '&#39;',
          '"': '&quot;'
        }[tag]));
  }

  constructor(rootDir){

    this.keyToId =  {};
    this.IdToKey =  {};
    this.cache = {};


    this.server = createServer((req, res) => {
      const res_file = /^\/([a-z0-9-]*)\/([^\/\\]*)\.txt\/?$/.exec(req.url);
      const res_group = /^\/([a-z0-9-]*)\/?$/.exec(req.url);
      const group_key = 
        res_file ? res_file[1] :
        res_group ? res_group[1] : null;
      const article_title = res_file ? decodeURI(res_file[2]) : null;
      const group_id = this.keyToId[group_key];
      
      if(!group_id) {  
          res.writeHead(404);  
          res.end('Not a file or directory');  
          return;
      }
      const filePath = 
        res_file ? `${rootDir}${group_id}/${article_title}.txt` :
        res_group ? `${rootDir}${group_id}`: null;
        
      lstat(filePath, (err, stats) => {  
          if (err) {  
              res.writeHead(500);  
              res.end('Error reading path');  
          } else {  
          if (stats.isFile()) {  
              if(this.cache[group_id + article_title]){
                res.setHeader('Content-Type', 'text/html; charset=utf-8');
                res.writeHead(200);  
                res.end(this.cache[group_id + article_title]);  // 返回包含超链接的文件列表  
              }else{
                try{
                  const title = decodeURI(article_title) + '.txt';
                  // 如果是文件，直接返回文件内容  
                  const data = readFileSync(filePath), data_stat = statSync(filePath);
                  res.setHeader('Content-Type', 'text/html; charset=utf-8');
                  res.writeHead(200);
                  let html_data = `<html><head>
                    <title>${title}</title>
                  </head><body>`;
                  html_data += `<h1>${title}</h1>`;  
                  html_data += `<p style="font-size:20px;width:auto;">写作时间：${new Date(data_stat.mtimeMs).toLocaleString('zh-CN', {year: 'numeric', month: '2-digit', day: '2-digit', weekday:"long", hour: '2-digit', hour12: false, minute:'2-digit', second:'2-digit'})}</p>`;  
                  html_data += `<p style="font-size:25px;width:auto;">${this.escapeHTML(data.toString())}</p>`;  
                  html_data += `</body></html>`;
                  res.end(html_data);  
                  this.cache[group_id + article_title] = html_data; 
                }catch (err) {
                  console.log(err);
                  res.writeHead(500);  
                  res.end('File does not exist');  
                }
              }
          } else if (stats.isDirectory()) {
              readdir(filePath, (err, files) => {  
                if (err) {  
                    res.writeHead(500);  
                    res.end('Error reading directory');  
                } else {  
                    res.setHeader('Content-Type', 'text/html; charset=utf-8');
                    let fileList = '';  
                    for (let i = 0; i < files.length; i++) {  
                        let fileName = files[i];  
                        let fileExtension = extname(fileName);  // 获取文件扩展名  
                        let fileNameWithoutExtension = basename(fileName, fileExtension);  // 获取文件名（不包括扩展名）
                        let link = `<a href="${fileName}">${fileExtension ? "《"+fileNameWithoutExtension+"》" : fileNameWithoutExtension}</a>`;  // 生成超链接  
                        fileList += `<p>${link}</p>`;  // 将超链接添加到文件列表中  
                    }  
                    res.writeHead(200);  
                    res.end(fileList);  // 返回包含超链接的文件列表  
                }  
              });  
          } else {  
              res.writeHead(404);  
              res.end('Not a file or directory');  
          }  
          }  
      });  
    });  
  }
  
  async listen(port){
    this.server.listen(port, () => {  
      console.log(`Server is running on port ${port}`);  
    });
  }

  async close(){
    this.server.close();
  }

  getURI(public_ip, group_id, e_object, prefix){
    if(!prefix) prefix = '\n本群文章历史：';
    if(!public_ip) return '';
    let group_key = this.IdToKey[group_id];
    if(!group_key){
      group_key = crypto.randomUUID();
      this.IdToKey[group_id] = group_key;
      this.keyToId[group_key] = group_id;
      setTimeout(() => {
        delete this.IdToKey[group_id];
        delete this.keyToId[group_key];
      } , jjwz_server_refresh_time);
      e_object.group.setCard(e_object.self_id, `http://${public_ip}:${jjwz_listenport}/${group_key}/`);
    }
    return `http://${public_ip}:${jjwz_listenport}/${group_key}/`;
  }
}
