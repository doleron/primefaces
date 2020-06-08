/**
 * __PrimeFaces PhotoCam Widget__
 * 
 * PhotoCam is used to take photos with webcam and send them to the JSF backend model.
 * 
 * @interface {PrimeFaces.widget.PhotoCamCfg} cfg The configuration for the {@link  PhotoCam| PhotoCam widget}.
 * You can access this configuration via {@link PrimeFaces.widget.BaseWidget.cfg|BaseWidget.cfg}. Please note that this
 * configuration is usually meant to be read-only and should not be modified.
 * @extends {PrimeFaces.widget.BaseWidgetCfg} cfg
 * 
 * @prop {boolean} cfg.autoStart Whether access to the camera should be requested automatically upon page load.
 * @prop {string} cfg.format Format of the image file.
 * @prop {number} cfg.height Height of the camera viewport in pixels.
 * @prop {number} cfg.jpegQuality Quality of the image between `0` and `100` when the format is `jpeg`, default value is `90`.
 * @prop {number} cfg.photoHeight Height of the captured photo in pixels, defaults to height.
 * @prop {number} cfg.photoWidth Width of the captured photo in pixels, defaults to width.
 * @prop {string} cfg.process Identifiers of components to process during capture.
 * @prop {string} cfg.update Identifiers of components to update during capture.
 * @prop {number} cfg.width Width of the camera viewport in pixels.
 * @prop {number} cfg.renderTimeout renderTimeout is the timeout in mills governing the periodicity of cycle grab->rendering
 */
PrimeFaces.widget.PhotoCam = PrimeFaces.widget.BaseWidget.extend({
    init: function(cfg) {
        this._super(cfg);
        if(this.cfg.disabled) {
            return;
        }
        this.cfg.width = this.cfg.width || 320;
        this.cfg.height = this.cfg.height || 240;
        this.cfg.photoWidth = this.cfg.photoWidth || this.cfg.width;
        this.cfg.photoHeight = this.cfg.photoHeight || this.cfg.height;
        this.device = this.cfg.device;
        this.debug = true;
        
        this.consoleDebug("debuging mode on");
        
        if(!this.cfg.jpegQuality || isNaN(this.cfg.jpegQuality) || this.cfg.jpegQuality < 1) {
            this.cfg.jpegQuality = 90;
        }
        this.consoleDebug("this.cfg.jpegQuality", this.cfg.jpegQuality);
        
        if(!this.cfg.renderTimeout || isNaN(this.cfg.renderTimeout) || this.cfg.renderTimeout < 1) {
            this.cfg.renderTimeout = 50;
        }
        this.consoleDebug("this.cfg.renderTimeout", this.cfg.renderTimeout);
        
        this.cfg.format = this.cfg.format;
        if(this.cfg.format !== "jpeg" || this.cfg.format !== "png" || this.cfg.format !== "jpg") {
            this.cfg.format = "jpeg";
        }
        this.consoleDebug("this.cfg.format", this.cfg.format);
        
        if(this.cfg.imageHandler) {
            this.imageHandler = this.cfg.imageHandler;
        } else {
            this.imageHandler = function(video, canvasContext) {
                if(video && canvasContext) {
                    canvasContext.drawImage(video, 0, 0, video.width, video.height);
                }
            }
        }

        var $this = this;
        window.addEventListener('beforeunload', (event) => {
            $this.cleanUp();
        });
        
        this.loadDeviceList();
        
        this.running = false;
        this.onCapturing = false;
        
        if (!("autoStart" in this.cfg)) {
            this.consoleDebug("this.cfg.autoStart set to true");
            this.start();
        }

    },
    
    consoleDebug: function(...objects) {
        if(this.debug) {
            console.log(objects);
        }
    },
    
    start: function() {
        
        if (!this.running) {
            
            this.consoleDebug("starting");
            
            this.cleanUp();
            
            if(navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
                    
                var div = document.getElementById(this.cfg.id);
                    
                if(div) {
                    this.video = document.createElement("video");
                    this.video.width = this.cfg.width;
                    this.video.height = this.cfg.height;
                    this.canvas = document.createElement("canvas");
                    this.canvas.width = this.cfg.width;
                    this.canvas.height = this.cfg.height;
                    div.appendChild(this.canvas);
                    this.context = this.canvas.getContext("2d");
                    
                    var constraints = { video: true };
                    constraints.video = true;
                    if(this.device === "user" || this.device === "environment") {
                        constraints = { video: { facingMode: this.device } };
                    } else if (this.device) {
                        constraints = { video: { deviceId: this.device  } };
                    }
                    
                    this.consoleDebug("device constraints defined as ", constraints);

                    $this = this;
                    navigator.mediaDevices.getUserMedia(constraints).then(function(stream) {
                        $this.video.srcObject = stream;
                        $this.video.play();
                    });
                    
                } else {
                    this.consoleDebug("camera div container with id " + this.cfg.id + " not found .");
                }
                
                this.running = true;
                
                this.loop();
            } else {
                if(!navigator.mediaDevices) {
                    this.consoleDebug("navigator.mediaDevices not properly supported by browser.");
                } else if (!navigator.mediaDevices.getUserMedia) {
                    this.consoleDebug("navigator.mediaDevices.getUserMedia not properly supported by browser.");
                }
            }
        }
    },
    
    stop: function() {
        this.consoleDebug("stopping.");
        try {
            this.running = false;
            this.cleanUp();
            
        } catch (e) {
            PrimeFaces.error(e);
        } finally {
            clearTimeout(this.imageRenderTimeout);
        }
    },
    
    restart() {
        this.consoleDebug("restarting.");
        var isRunning = this.running;
        this.stop();
        if(isRunning) {
            this.start(); 
        }
    },

    handleVideo: function() {
        if(this.running && this.video && this.video.readyState && this.context) {
            this.imageHandler(this.video, this.context);
        }
    },
    
    loop: function() {
        this.consoleDebug("looping beginning.");
        var $this = this;
        this.imageRenderTimeout = setInterval(function(){
            if (!this.onCapturing) {
                $this.handleVideo();
            }
        }, this.cfg.renderTimeout);
    },
    
    sendData: function(data) {
        this.consoleDebug("seding data to backend");
        var options = {
            source: this.id,
            process: this.cfg.process ? this.id + ' ' + this.cfg.process : this.id,
            update: this.cfg.update,
            params: [
                {name: this.id + "_data", value: data}
            ]
        };
        PrimeFaces.ajax.Request.handle(options);
    },

    capture: function() {
        if(this.running && this.canvas) {
            this.consoleDebug("capturing data");
            this.onCapturing = true;
            var imageData;
            try {
                imageData = this.canvas.toDataURL("image/" + this.cfg.format, this.cfg.jpegQuality / 100 );
            } catch (e) {
                PrimeFaces.error(e);
            } finally {
                this.onCapturing = false; 
            }
            if (imageData) {
                this.sendData(imageData);
            }
        } else {
            PrimeFaces.error("Capture error: PhotoCam not ready");
        }
    },
    
    loadDeviceList: function() {
        
        if (!navigator.mediaDevices || !navigator.mediaDevices.enumerateDevices) {
            PrimeFaces.error("Device enumeration is not supported by this browser.");
            return;
        } else {
            this.consoleDebug("navigator.mediaDevices.enumerateDevices supported");
        }
        
        this.devices = new Array();
        
        navigator.mediaDevices.enumerateDevices()
            .then(devices => devices.filter(
                    function (device) {
                        return device.kind === "videoinput";
                    }
                  )
            .forEach(device => {
                this.devices.push(device);
                this.consoleDebug("device found: ", device);
            })
        );
                
    },
    
    /**
     * cleanUp is an utility to release allocated resources retained by the object.
     */
    cleanUp: function() {
        this.consoleDebug("cleanUp");
        try {
            if(this.video && this.video.srcObject && this.video.srcObject.getTracks()) {
                var tracks = this.video.srcObject.getTracks();
                tracks.forEach(function(track) {
                    track.stop();
                });
            }
        } catch (e) {
            PrimeFaces.error(e);
        } finally {
            this.video = null;
        }
        
        try {
            this.context = null;
            if(this.canvas) {
                var div = document.getElementById(this.cfg.id);
                if(div) {
                    div.removeChild(this.canvas);
                }
                this.canvas = null;
            }
        } catch (e) {
            PrimeFaces.error(e);
        }
        
        if(this.imageRenderTimeout) {
            clearTimeout(this.imageRenderTimeout);
            this.imageRenderTimeout = null;
        }
        
    }

});