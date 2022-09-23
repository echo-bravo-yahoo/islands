settings {
   logfile    = "/tmp/lsyncd.log",
   statusFile = "/tmp/lsyncd.status",
}

sync {
   default.rsyncssh,
   source="/home/swift/workspace/islands/islands-rewrite",
   host="pi@192.168.1.127",
   exclude = {
     "node_modules/**,",
     "ipc/**",
     "config.json",
     "package-lock.json",
     "package.json"
   },
   targetdir="/home/pi/workspace/islands/islands-rewrite",
   rsync = {
     archive = true,
     compress = false,
     whole_file = false
   },
   ssh = {
     identityFile="/home/swift/.ssh/islands_id_rsa"
   }
}
