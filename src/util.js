const os = require("os");
// 4
//os.networkInterfaces() 方法返回一个对象，其中包含有关每个网络接口的信息。返回的对象将包含网络接口数组

function getIp() {
  let interfaces = os.networkInterfaces();
//   console.log(interfaces);
  // interfaces = Object.values(interfaces); 拿不到正确值 原以为只是一个简单的一唯数组
  interfaces = Object.values(interfaces).reduce((memo, current) => {
    return memo.concat(current);
  }, []);
  let ip = interfaces.find((item) => {
    // 为什么是item.family==='IPv4'&&item.cidr.startWith('192')
    // ifconfig 查看我们的ip 对应en0  的inet 对应值 就是 192开头
    //interfaces打印有很多ip  192开头 对应的是IPv4
    return item.family === "IPv4" && item.cidr.startsWith("192");
  });
  return ip;
}

this.getIp = getIp;
