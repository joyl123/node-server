const option = {
  port: {
    option: "-p, --port <n>", //根据commander的option（‘’）
    default: 8080, //默认端口
    usage: "fs --port 3000", //用法
    description: "set fs port", //描述
  },
  gzip: {
    option: "-g,  --gzip <n>",
    default: 1, //默认压缩
    usage: "fs --gzip 0", //用法：设置不压缩
    description: "set fs gzip", //描述 设置是否压缩
  },
  cache: {
    option: "-c,  --cache <n>",
    default: 1, //默认 缓存
    usage: "fs --cache 0", //用法：设置不缓存
    description: "set fs cache", //描述 设置是否压缩
  },
  directory: {
    //目录
    option: "-d,  --directory <d>", //命令的简称和全称
    default: process.cwd(), //process.cwd()方法返回 Node.js 进程的当前工作目录。
    usage: "fs --directory d:", //用法：
    description: "set fs directory", //描述 设置目录
  },
};
module.exports = option;
