function insertScript(url) {
  var s = document.createElement('script');
  s.type = 'text/javascript';
  s.async = true;
  s.src = url;
  var x = document.getElementsByTagName('head')[0];
  x.appendChild(s);
}

function insertStyle(url) {
  var s = document.createElement('link');
  s.type = 'text/css';
  s.href = url;
  s.rel = "stylesheet"
  var x = document.getElementsByTagName('head')[0];
  x.appendChild(s);
}

window.denBootstrap = {
  getHashData: function () {
    try {
      if (window.location.hash && window.location.hash.length > 1) {
        return window.denBootstrap.decodeHash(window.location.hash)
      } else {
        return null
      }
    } catch (e) {
      console.error(e)
      return null
    }
  },
  decodeHash: function (hashStr) {
    try {
      var str = hashStr
      if (str.indexOf("#") !== -1) {
        str = str.substring(str.indexOf("#") + 1)
      }
      var decoded = JSON.parse(window.atob(str))
      console.table(decoded)
      return decoded
    } catch (e) {
      console.error(e)
      return null
    }
  },
  setConnection: function (info) {
    window.denBootstrap.connectionInfo = info
    return localStorage.setItem('denServer', JSON.stringify(info))
  },
  getConnection: function () {
    try {
      return JSON.parse(localStorage.getItem('denServer'))
    } catch (e) {
      return null
    }
  },
  connectionInfo: {},
  started: false,
  connect: function (providedInfo = {}) {
    var defaultInfo = {
      ip: null,
      port: 36411,
      isDev: false,
      session: null
    }

    var savedInfo = window.denBootstrap.getConnection()
    var info = defaultInfo
    if (savedInfo) {
      info = Object.assign(info, savedInfo)
    }
    info = Object.assign(info, providedInfo)

    if (!window.denBootstrap.started && info.ip) {

      // Eventually we should make sure the server/JS/CSS can be found first.

      window.denBootstrap.started = true
      window.denBootstrap.setConnection(info)
      window.denServer = info.ip

      insertStyle('http://' + info.ip + ':' + (info.isDev ? "3002" : info.port) + '/app-merged.css')
      insertScript('http://' + info.ip + ':' + (info.isDev ? "3002" : info.port) + '/app.js')
      document.getElementById("bootstrap").classList.add("done")
    }
  }
}

var hashData = window.denBootstrap.getHashData() // Get info from QR code
var connectionInfo = (hashData && typeof hashData === "object" ? hashData : {})

window.denBootstrap.connect(connectionInfo)


// QR Scanner

var video = document.createElement("video");
var canvasElement = document.getElementById("canvas");
var canvas = canvasElement.getContext("2d");
var loadingMessage = document.getElementById("loadingMessage");
var outputContainer = document.getElementById("output");
var outputMessage = document.getElementById("outputMessage");
var outputData = document.getElementById("outputData");
var scannerDone = false

function drawLine(begin, end, color) {
  canvas.beginPath();
  canvas.moveTo(begin.x, begin.y);
  canvas.lineTo(end.x, end.y);
  canvas.lineWidth = 4;
  canvas.strokeStyle = color;
  canvas.stroke();
}

function startScanner() {
  // Use facingMode: environment to attemt to get the front camera on phones
  navigator.mediaDevices.getUserMedia({
    video: {
      facingMode: "environment"
    }
  }).then(function (stream) {
    scannerDone = false
    window.aVideo = video
    window.aStream = stream
    video.srcObject = stream;
    video.setAttribute("playsinline", true); // required to tell iOS safari we don't want fullscreen
    video.play();
    requestAnimationFrame(tick);
  });
}



function tick() {
  if (scannerDone) return false;
  loadingMessage.innerText = "Loading camera stream..."
  if (video.readyState === video.HAVE_ENOUGH_DATA) {
    loadingMessage.hidden = true;
    canvasElement.hidden = false;
    outputContainer.hidden = false;

    canvasElement.height = video.videoHeight;
    canvasElement.width = video.videoWidth;
    canvas.drawImage(video, 0, 0, canvasElement.width, canvasElement.height);
    var imageData = canvas.getImageData(0, 0, canvasElement.width, canvasElement.height);
    var code = jsQR(imageData.data, imageData.width, imageData.height, {
      inversionAttempts: "dontInvert",
    });
    if (code) {
      drawLine(code.location.topLeftCorner, code.location.topRightCorner, "#FF3B58");
      drawLine(code.location.topRightCorner, code.location.bottomRightCorner, "#FF3B58");
      drawLine(code.location.bottomRightCorner, code.location.bottomLeftCorner, "#FF3B58");
      drawLine(code.location.bottomLeftCorner, code.location.topLeftCorner, "#FF3B58");
      outputMessage.hidden = true;
      outputData.parentElement.hidden = false;
      outputData.innerText = code.data;
      console.log(code.data)
      if (code.data.indexOf("#") === -1) {
        // Invalid code
      } else {
        try {
          var decoded = window.denBootstrap.decodeHash(code.data)
          console.table(decoded)
          if (decoded && decoded.ip) {
            // Connect to server
            window.denBootstrap.connect(decoded)
            // Stop loop
            scannerDone = true
            // Close camera
            var stream = video.srcObject;
            var tracks = stream.getTracks();
            tracks.forEach(function (track) {
              track.stop();
            });
            video.srcObject = null;
          }
        } catch (e) {
          console.error(e)
        }

      }
    } else {
      outputMessage.hidden = false;
      outputData.parentElement.hidden = true;
    }
  }
  requestAnimationFrame(tick);
}


document.querySelector("#qrStart").addEventListener("click", function () {
  startScanner()
})