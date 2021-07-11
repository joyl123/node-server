const http = require("http");
const chalk = require("chalk"); // 给控制台的打印 加点颜色 //npm install chalk 安装
const util = require("./util");
const url = require("url"); //解析文件路径返回对应信息
const path = require("path"); //路径拼接用
const fs = require("fs").promises;
const mime = require("mime"); //npm install mime 安装依赖
const { createReadStream, readFileSync } = require("fs");
const ejs = require("ejs"); //EJS 是一套简单的模板语言，帮你利用普通的 JavaScript 代码生成 HTML 页面,模版字符串
const crypto = require("crypto");
const zlib = require("zlib");

// readFileSync 同步读取,文件运行的时候就要拿到目标文件
const template = readFileSync(
  path.resolve(__dirname, "template.html"),
  "utf-8"
);

class Server {
  // 1:初始化默认参数
  constructor(serverOptions) {
    this.port = serverOptions.port;
    this.directory = serverOptions.directory;
    this.cache = serverOptions.cache;
    this.gzip = serverOptions.gzip;
    this.template = template;
  }

  handleRequest = async (req, res) => {
    //1:获取请求路径，以当前目录为基准查找文件，如果文件存在，不是文件夹则直接返回
    let { pathname } = url.parse(req.url); //获取解析的路径 的相对路径
    // pathname默认是 百分比编码，只允许包含一定范围的字符。任何超出该范围的字符都必须进行编码，汉字是超出了可被表示的编码 ，所以会被进行转义
    //百分比编码解释地址： https://nodejs.org/api/url.html#whatwg-percent-encoding
    // decodeURIComponent正确识别汉字 和其他特殊字符
    pathname = decodeURIComponent(pathname);
    let requestFile = path.join(this.directory, pathname);
    let stateObj = await fs.stat(requestFile);
    try {
      // 判断requestFile 是文件夹还是文件
      if (stateObj.isDirectory()) {
        // 文件夹
        const dirs = await fs.readdir(requestFile);
        // 根据数据和模版渲染
        let fileContent = await ejs.render(this.template, {
          dirs: dirs.map((dir) => ({
            // 标题名文件名
            name: dir,
            // 路径拼接 相对路径+文件名 就是 子文件/文件的对应的路径
            url: path.join(pathname, dir),
          })),
        });
        res.setHeader("Content-Type", "text/html;charset=utf-8");
        res.end(fileContent);
        // res.end(JSON.stringify(dirs));//打印查看文件夹下文件组成的数组格式 的数据
      } else {
        // 文件
        // res.setHeader(
        //   "Content-Type",
        //   mime.getType(requestFile) + ";charset=utf-8"
        // );
        // createReadStream(requestFile).pipe(res);

        // 1:statObj 在这里始终会报 statObj is not defined 导致整个this.sendFile走不下去
        // 2:但是 打印却可以正常打印
        this.sendFile(req, res, requestFile, statObj);
      }
    } catch (e) {
      // 既不是文件夹也不是文件 说明 请求路径不存在
      this.sendError(req, res, e);
    }
  };
  cacheFile = (req, res, requestFile, statObj) => {
    // 结合强缓存使用
    res.setHeader("Cache-Control", "max-age=10");
    res.setHeader("Expires", new Date(Date.now() + 10 * 1000).toUTCString());
    const lastModified = statObj.ctime.toUTCString();
    const eTag = crypto
      .createHash("md5")
      .update(readFileSync(requestFile))
      .digest("base64");
    res.setHeader("Last-Modified", lastModified);
    res.setHeader("Etag", eTag);
    let ifModifiedSince = req.headers["if-none-match"];
    let ifNoneMatch = req.headers["if-none-match"];
    if (lastModified !== ifModifiedSince) {
      //时间检测颗粒不同w无法精确到毫秒 ，有可能时间相同 ，但 资源内容不同，比如一秒内不断修改n多次的，就可能不被精准捕获修改时间
      return false;
    }
    if (ifNoneMatch !== eTag) {
      //以防时间 比对不够精确，实际场景 etag不会根据资源全量生成
      return false;
    }
    return true;
  };

  //文件压缩
  gzipFile = (req, res, requestFile, statObj) => {
    //浏览器会给服务器发 一个header accept-encoding的字段，查看浏览器支持什么压缩
    let encoding = req.headers["accept-encoding"];
    //判断浏览器支持的压缩方式,用对应的压缩方式去压缩文件并return
    if (encoding) {
      //浏览器也需要知道服务器的压缩类型，否则无法处理会乱码//整体上除了图片和视频之类的 静态资源都走gzip 因为图片资源走更多的是缓存优化
      if (encoding.includes("gzip")) {
        res.setHeader("Content-Encoding", "gzip");
        return zlib.createGzip();
      } else if (encoding.includes("deflate")) {
        res.setHeader("Content-Encoding", "deflate");
        return zlib.createDeflate();
      }
    }
    return false; //浏览器不支持压缩
  };
  // 文件读取
  sendFile = (req, res, requestFile, statObj) => {
    // 设置缓存
    // 判断有没有命中缓存（协商缓存），有返回状态码304
    if (this.cacheFile(req, res, requestFile, statObj)) {
      res.statusCode = 304;
      return res.end();
    }
    // 通过设置头部信息，返回文件 需要给浏览器提供内容类型和内容的编码格式
    // https://tool.oschina.net/commons/ 查找所需要的content-type
    //  接收文件路径 返回该文件对应的文件类型格式 ，这里用到第三方模块 mime
    res.setHeader("Content-Type", mime.getType(requestFile) + ";charset=utf-8");

    //  压缩的使用
    let createGzip;
    if ((createGzip = this.gzipFile(req, res, requestFile, statObj))) {
      // 看下支不支持压缩，支持返回一个压缩流
      return createReadStream(requestFile).pipe(createGzip).pipe(res); //这其实就是一个很典型的转化流了
    }
    // 读取文件 并返回文件读取到的内容 ，利用 的是流
    createReadStream(requestFile).pipe(res); //会自动调用 ws.write(),ws.end()
  };

  // 处理请求路径不存在 错误
  sendError = (req, res, e) => {
    // 错误的的测试结果图片在wordImg里  对应的图片；自定义 http服务 请求路径不存在时候 测试 结果
    res.statusCode = 404;
    res.end(`Not Found`);
  };
  //启动服务监听端口占用错误信息，如果端口占用，端口号累加1
  //使用 fs --port 3000 启动的服务的时候 设置端口号为3000，其他
  start() {
    //  http.createServer 创建一个本地服务
    const server = http.createServer(this.handleRequest);
    //监听端口
    server.listen(this.port, (err) => {
      //订阅方法，监听成功后会触发
      console.log(chalk.yellow("Starting up http-server, serving ./\n"));
      console.log("Available on:\n");
      console.log(
        `http://` + util.getIp().address + `:${chalk.green(this.port)}\n`
      );
      console.log(`http://127.0.0.1:${chalk.green(this.port)}\n`);
    });
    server.on("error", (err) => {
      if (err.errno === "EADDRINUSE") {
        //端口被占用时 自动累加
        server.listen(++this.port);
      }
    });
  }
}
module.exports = Server;
