#! /usr/local/bin/node
// 告诉终端 用node执行的，指定这个脚本的解释程序是nod

const program = require("commander");
const option = require("./config");
program.name("fs");
program.usage("[option]");
const examples = new Set();
const defaultMapping = {};
Object.entries(option).forEach(([key, value]) => {
  examples.add(value.usage);
  defaultMapping[key] = value.default;
  program.option(value.option, value.description);
})
program.on("--help", function () {
  // \n 换行
  console.log("\nExamples:");
  examples.forEach((item) => {
    console.log(`${item}`);
  });
});

program.parse(process.argv);

// 打印用户输入的  配置项
// 对应输入 fs --port 3000 查看
let userArgs = program.opts();

// 合并用户配置 和默认的 一同打印，查看启动参数
let serverOptions = Object.assign(defaultMapping, userArgs);
console.log({ serverOptions });
const Server = require("../src/index");
// let server = new Server(serverOptions);
let server = new Server(serverOptions);

server.start();
