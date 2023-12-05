import { lstat, readFile, readdir } from 'node:fs';
import { createServer } from 'http';
import { basename, extname, join } from "node:path";

export class jjwz_Server{
  constructor(rootDir){
    this.server = createServer((req, res) => {  
      const res_file = /^\/([0-9]*)\/([^\/\\]*\.txt)$/.exec(req.url);
      const res_group = /^\/([0-9]*)$/.exec(req.url);
      let filePath = 
          req.url == rootDir ? "/" :
          res_file ? `${rootDir}${res_file[1]}/${decodeURI(res_file[2])}` :
          res_group ? `${rootDir}${res_group[1]}`: null;
      if(!filePath) {  
          res.writeHead(404);  
          res.end('Not a file or directory');  
          return;
      }
      let filePathWithoutRootdir = filePath.slice(rootDir.length);
      lstat(filePath, (err, stats) => {  
          if (err) {  
              res.writeHead(500);  
              res.end('Error reading path');  
          } else {  
          if (stats.isFile()) {  
              // 如果是文件，直接返回文件内容  
              readFile(filePath, (err, data) => {  
              if (err) {  
                  res.writeHead(500);  
                  res.end('Error reading file');  
              } else {  
                  res.setHeader('Content-Type', 'text/html; charset=utf-8');
                  res.writeHead(200);  
                  res.end(data);  
              }  
              });  
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
                      let filePathForLink = join(filePathWithoutRootdir, fileNameWithoutExtension) + fileExtension;  // 构造超链接的文件路径，注意去掉一开始的"data"串  
                      let link = '<a href="' + filePathForLink + '">' + fileName + '</a>';  // 生成超链接  
                      fileList += '<p>' + link + '</p>';  // 将超链接添加到文件列表中  
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
}
