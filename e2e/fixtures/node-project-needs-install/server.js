const http = require('http')
const ms = require('ms')
const port = process.env.PORT || 3000
http.createServer((req, res) => res.end(`ok ${ms('1s')}`)).listen(port)
