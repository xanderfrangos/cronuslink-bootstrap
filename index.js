const express = require('express');
const path = require("path")
const app = express();

app.use(require('cors'));
app.use('/', express.static(path.join(__dirname, "./docs/")))
app.listen(3004)

console.log("[Bootstrap] Started bootstrap server at http://localhost:3004/")