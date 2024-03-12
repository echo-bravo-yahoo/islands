module.exports = {
  apps : [{
    name   : "island",
    script : "/home/pi/islands/islands-rewrite/index.js",
    watch: ["/home/pi/islands/islands-rewrite"],
    ignore_watch: ["**/node_modules/**", ".git/**", "**/*.log"],
    max_restarts: 3,
    min_uptime: 10000
  }]
}
