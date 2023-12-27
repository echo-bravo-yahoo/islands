module.exports = {
  apps : [{
    name   : "island",
    script : "/home/pi/islands/islands-rewrite/index.js",
    watch: ["/home/pi/islands"],
    ignore_watch: ["/home/pi/islands/node_modules", "/home/pi/islands/.git"],
    max_restarts: 3,
    min_uptime: 10000
  }]
}
