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

window.cronusLinkBootstrap = {
  getHashData: function () {
    try {
      if (window.location.hash && window.location.hash.length > 1) {
        return window.cronusLinkBootstrap.decodeHash(window.location.hash)
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
      var arr = atob(str).split("|")
      arr[1] = arr[1].split(",")
      var decoded = {
        isDev: arr[0],
        ips: arr[1],
        session: arr[2]
      }
      return decoded
    } catch (e) {
      console.log(e)
      return null
    }
  },
  setConnection: function (info) {
    console.log("Storing connection info:", info)
    window.cronusLinkBootstrap.connectionInfo = info
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
  connect: async function (providedInfo = {}) {
    var defaultInfo = {
      ip: null,
      ips: [],
      port: 36411,
      isDev: false,
      session: null
    }

    var savedInfo = window.cronusLinkBootstrap.getConnection()
    var info = defaultInfo
    if (savedInfo) {
      info = Object.assign(info, savedInfo)
    }
    info = Object.assign(info, providedInfo)

    // If no info and HTTP, switch to HTTPS for camera
    if (!info.ip && (!info.ips || info.ips.length == 0) && window.location.protocol === "http:") {
      window.location.href = "https://cronus.link/#allowHTTPS"
      return false
    }

    // If a list of IPs was provided, scan them to see if a valid server is available
    if (info.ips) {
      for (let i = 0; i < info.ips.length; i++) {
        var version = false
        try {
          var response = await fetch("http://" + info.ips[i] + ":" + info.port + "/v")
          version = await response.json()
        } catch (e) {
          console.log("Couldn't connect to IP:", e)
        }
      }

      console.log("http://" + info.ips[i] + ":" + info.port + "/v : ", version)
      if (version) {
        info.ip = info.ips[i]
        console.log("WORKING IP:", info)
      } else {
        // Couldn't find a working IP
        window.location.href = "https://cronus.link/#allowHTTPS"
        return false
      }
    }

    console.log("A", window.cronusLinkBootstrap.started, info.ip)
    if (!window.cronusLinkBootstrap.started && info.ip) {
      console.log("Trying connect", info)

      // Eventually we should make sure the server/JS/CSS can be found first.

      window.cronusLinkBootstrap.started = true
      window.cronusLinkBootstrap.setConnection(info)
      window.cronusLinkServer = info.ip

      insertStyle('http://' + info.ip + ':' + (info.isDev ? "3002" : info.port) + '/app-merged.css')
      insertScript('http://' + info.ip + ':' + (info.isDev ? "3002" : info.port) + '/app.js')
      document.getElementById("bootstrap").classList.add("done")
    }
  }
}

var hashData = window.cronusLinkBootstrap.getHashData() // Get info from QR code
var connectionInfo = (hashData && typeof hashData === "object" ? hashData : {})

window.cronusLinkBootstrap.connect(connectionInfo)
history.replaceState({}, document.title, ".") // Remove hash if it was used


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
          var decoded = window.cronusLinkBootstrap.decodeHash(code.data)
          console.table(decoded)
          if (decoded && decoded.ips) {
            // Connect to server
            if (window.location.protocol === "https:") {
              // Switch to HTTP for connection
              window.location.href = code.data
              return false;
            }
            window.cronusLinkBootstrap.connect(decoded)
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