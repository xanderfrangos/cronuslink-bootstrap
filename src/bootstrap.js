import jsQR from "jsqr";
import 'regenerator-runtime/runtime'

window.cronusLinkBootstrap = {
  bootstrapVer: 1,
  serverVer: {
    name: 'cronuslink',
    server: false,
    api: false
},
  setScreen: function (screen) {
    document.getElementById("bootstrap-screens").dataset.screen = screen
  },
  getHashData: function () {
    try {
      if (window.location.hash && window.location.hash.length > 1) {
        return window.cronusLinkBootstrap.decodeHash(window.location.hash)
      } else {
        return false
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
        isDev: arr[0] * 1,
        ips: arr[1],
        authID: arr[2],
        hostID: arr[3],
        remote: arr[4] ?? "api.cronus.link"
      }
      return decoded
    } catch (e) {
      console.log(e)
      return null
    }
  },
  setConnection: function (infoIn) {
    var info = infoIn
    if (info.ips) delete info.ips
    console.log("Storing connection info:", info)
    window.cronusLinkBootstrap.connectionInfo = info
    return localStorage.setItem('connectionInfo', JSON.stringify(info))
  },
  getConnection: function () {
    try {
      return JSON.parse(localStorage.getItem('connectionInfo'))
    } catch (e) {
      return null
    }
  },
  doAuth: async function(infoIn) {
    try {
      const response = await fetch(`${window.location.protocol}//${infoIn.ip}/auth/${infoIn.hostID}`, {
        method: "POST",
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
        body: JSON.stringify({ deviceType: "Web", deviceName: "WebBootstrap", authID: infoIn.authID, authValue: infoIn.authValue})
      })
      const json = await response.json()
      if(json.status === 200) return json.data;
      return false
    } catch(e) {
      return false
    }
  },
  setInvalid: function () {
    localStorage.setItem('invalidAuth', 1)
    localStorage.removeItem('connectionInfo')
    localStorage.removeItem('games')
    window.location.href = `${window.location.origin}`
    return true
  },
  clearInvalid: function () {
    localStorage.removeItem('invalidAuth')
    return true
  },
  isInvalid: function () {
    return (localStorage.getItem('invalidAuth') == 1 ? true : false)
  },
  resetConnection: function () {
    localStorage.removeItem('connectionInfo')
    localStorage.removeItem('games')
    localStorage.removeItem('invalidAuth')
    window.location.href = `${window.location.origin}`
    return true
  },
  connectionInfo: {},
  lastAttemptedConnection: false,
  started: false,
  connect: async function (providedInfo = {}) {
    var defaultInfo = {
      ip: "api.cronus.link",
      ips: [],
      port: 36411,
      hostID: null,
      isDev: false,
      authID: null,
      remote: "api.cronus.link"
    }

    window.cronusLinkBootstrap.setScreen("loading")

    var savedInfo = window.cronusLinkBootstrap.getConnection()
    var info = defaultInfo
    if (savedInfo) {
      info = Object.assign(info, savedInfo)
    }
    info = Object.assign(info, providedInfo)
    
    // Fix undefined port
    info.port = (info.port ? info.port : 36411)

    window.cronusLinkBootstrap.lastAttemptedConnection = Object.assign({}, info)

    // If no info and HTTP, switch to HTTPS for camera
    if (!info.ip && (!info.ips || info.ips.length == 0) && window.location.protocol === "http:" && window.location.hostname == "cronus.link") {
      window.location.href = "https://cronus.link/"
      return false
    }

    // If a list of IPs was provided, scan them to see if a valid server is available
    if (info.ips && info.ips.length > 0) {
      var awaitArray = []
      for (let i = 0; i < info.ips.length; i++) {
        try {
          var response = new Promise((resolve, reject) => {
            setTimeout(reject, 6000)
            fetch(`${window.location.protocol}//` + info.ips[i] + "/v").then(result => resolve(result)).catch(err => reject(false))
          })
          awaitArray.push(response)
        } catch(e) {
          console.log(e)
        }
      }
      for (let i = 0; i < info.ips.length; i++) {
        var version = false
        try {
          version = await awaitArray[i]
          version = await version.json()
        } catch (e) {
          console.log("Couldn't connect to IP:", e)
        }

        console.log(`${window.location.protocol}//` + info.ips[i] + "/v : ", version)
        if (version) {
          info.ip = info.ips[i]
          window.cronusLinkBootstrap.serverVer = version
        }
      }
    } else if (info.ip) {
      // One IP was provided. Let's test it.
      try {
        var IPResponse = await new Promise((resolve, reject) => {
          setTimeout(reject, 6000)
          fetch(`${window.location.protocol}//` + info.ip + "/v").then(result => resolve(result))
        })
        var IPVersion = await IPResponse.json()
        console.log(IPVersion)
        if (!IPVersion) {
          throw ("Invalid response from CL server.")
        } else {
          window.cronusLinkBootstrap.serverVer = IPVersion
        }
      } catch (e) {
        console.log("Couldn't connect to requested IP.", e)
        window.cronusLinkBootstrap.setScreen("cant-connect")
        return false
      }
    }

    let remoteValid = false
    if(!info.ip && info.remote) {
      // Remote (public) URL was provided. Let's test it.
      try {
        var remoteResponse = await new Promise((resolve, reject) => {
          setTimeout(reject, 6000)
          fetch(window.location.protocol + "//" + info.remote + "/v").then(result => resolve(result))
        })
        var remoteVersion = (await remoteResponse.json())?.data
        if (!remoteVersion) {
          throw ("Invalid response from CL server.")
        } else {
          remoteValid = remoteVersion
          window.cronusLinkBootstrap.serverVer = remoteVersion
        }
        remoteValid = true
        info.isDev = false
        info.ip = info.remote
      } catch (e) {
        console.log("Couldn't connect to remote URL.", e)
      }
    }

    const authResponse = await window.cronusLinkBootstrap.doAuth(info)
    if (authResponse && !window.cronusLinkBootstrap.started && info.ip) {

      // Eventually we should make sure the server/JS/CSS can be found first.

      info.roomID = authResponse.roomID
      if(authResponse.authValue) info.authValue = authResponse.authValue
      window.cronusLinkBootstrap.started = true
      window.cronusLinkBootstrap.setConnection(info)
      window.cronusLinkServer = info.ip

      const hostVersion = await (await fetch(`${window.location.protocol}//${info.remote}/v/${authResponse.roomID}`)).json()
      window.cronusLinkBootstrap.hostVer = hostVersion

      const verString = `?${hostVersion.started}`

      insertStyle(`${window.location.protocol}//` + info.ip + (info.isDev ? "" : "") + `/proxy-assets/${info.roomID}/app-merged.css${verString}`)
      if(info.isDev) {
        insertScript(`${window.location.protocol}//` + info.ip + (info.isDev ? "" : "") + `/proxy-assets/${info.roomID}/app-merged.js${verString}`)
      }
      insertScript(`${window.location.protocol}//` + info.ip + (info.isDev ? "" : "") + `/proxy-assets/${info.roomID}/app.js${verString}`)
      document.getElementById("bootstrap").classList.add("done")
    } else {
      // Couldn't find a working IP
      if (!savedInfo && !window.cronusLinkBootstrap.getConnection()) {
        window.cronusLinkBootstrap.setScreen("no-server")
      } else {
        window.cronusLinkBootstrap.setScreen("cant-connect")
      }

    }
  }
}

if (window.cronusLinkBootstrap.isInvalid()) {
  // If authID was previously rejected, say so
  window.cronusLinkBootstrap.setScreen("invalid")
  window.cronusLinkBootstrap.clearInvalid()
} else if(window.cronusLinkBootstrap.getConnection()) {
  window.cronusLinkBootstrap.connect(window.cronusLinkBootstrap.getConnection())
} else if (window.location.hash != "#qr" && window.cronusLinkBootstrap.getHashData()) {
  var hashData = window.cronusLinkBootstrap.getHashData() // Get info from QR code
  if (hashData === null) {
    // If hash is garbled, say so
    window.cronusLinkBootstrap.setScreen("invalid")
  } else {
    // Hash is OK or not present
    var connectionInfo = (hashData && typeof hashData === "object" ? hashData : {})
    history.replaceState({}, document.title, ".") // Remove hash if it was used

    window.cronusLinkBootstrap.connect(connectionInfo)
  }
} else {
  window.cronusLinkBootstrap.setScreen("qr")
  startScanner()
}

// QR Scanner

var video = document.createElement("video");
var canvasElement = document.getElementById("canvas");
var canvas = canvasElement.getContext("2d");
var loadingMessage = document.getElementById("loadingMessage");
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
window.cronusLinkBootstrap.startScanner = startScanner


function tick() {
  if (scannerDone) return false;
  if (video.readyState === video.HAVE_ENOUGH_DATA) {
    loadingMessage.hidden = true;
    canvasElement.hidden = false;

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
      console.log(code.data)
      if (code.data.indexOf("#") === -1) {
        // Invalid code
      } else {
        try {
          var decoded = window.cronusLinkBootstrap.decodeHash(code.data)
          console.table(decoded)
          if (decoded && decoded.ips) {
            // Stop loop
            scannerDone = true
            // Close camera
            var stream = video.srcObject;
            var tracks = stream.getTracks();
            tracks.forEach(function (track) {
              track.stop();
            });
            video.srcObject = null;
            window.cronusLinkBootstrap.connect(decoded)
          }
        } catch (e) {
          console.error(e)
        }

      }
    }
  }
  requestAnimationFrame(tick);
}




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

document.querySelectorAll(".bootstrap-qrScreen").forEach(function (button) {
  window.cronusLinkBootstrap.clearInvalid()
  button.addEventListener("click", function () {
    if (window.location.protocol != "https:" && window.location.hostname != "localhost") {
      window.location.href = "https://cronus.link/"
    } else {
      window.cronusLinkBootstrap.setScreen("qr")
      startScanner()
    }
  })
})

document.querySelectorAll(".bootstrap-retry").forEach(function (button) {
  button.addEventListener("click", function () {
    window.cronusLinkBootstrap.connect(window.cronusLinkBootstrap.lastAttemptedConnection)
  })
})

document.querySelector("#bootstrap-menu svg").addEventListener("click", (e) => {
  document.querySelector("#bootstrap-menu").classList.toggle("show")
})