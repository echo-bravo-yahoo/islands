module.exports = {
  apps : [{
    name   : "island",
    script : "./index.js",
    watch: ["."],
    ignore_watch: ["./node_modules", "../.git"],
    max_restarts: 3,
    min_uptime: 10000
  }]
}
