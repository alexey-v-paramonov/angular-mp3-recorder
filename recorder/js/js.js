(function(window){

    var REC_WORKER_PATH = './js/recorderWorker.js',
        AUDIO_PREVIEW_TAG_ID = 'recorder-mp3-preview',
        MP3_UPLOAD_URL = '/recorder/upload.php';


    var app = angular.module('recorder', []);

    app.controller("recorderCtrl", ['$scope', '$http', function($scope, $http){

        var bufferSize = 4096,
            numChannels = 2,
            ctrl = this,
            audioPreview = document.getElementById(AUDIO_PREVIEW_TAG_ID);


        navigator.getUserMedia = navigator.getUserMedia || navigator.webkitGetUserMedia || navigator.mozGetUserMedia || navigator.msGetUserMedia;

        function bytesToSize(bytes) {
            var sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
            if (bytes == 0) return '0 Byte';
            var i = parseInt(Math.floor(Math.log(bytes) / Math.log(1024)));
            return Math.round(bytes / Math.pow(1024, i), 2) + ' ' + sizes[i];
        }

        function procesWavData(event){

            var buffers = event.data,
                encodeBuffers = [],
                sampleBlockSize = 1152,
                i = 0,
                mp3buf;

            // TODO: 44100 here replace with context info
            var mp3encoder = new lamejs.Mp3Encoder(2, 44100, 128);
            for (var channel = 0; channel < numChannels; channel++){
                encodeBuffers[channel] = new Float32Array(buffers[channel].length);
                for(i = 0; i < buffers[channel].length; i++){
                    encodeBuffers[channel][i] = buffers[channel][i]*32767.5;
                }

            }
            var mp3Data = [];
            console.log("Encoding...");
            for (i = 0; i < encodeBuffers[0].length; i += sampleBlockSize) {
                var leftChunk = encodeBuffers[0].subarray(i, i + sampleBlockSize);
                var rightChunk = encodeBuffers[1].subarray(i, i + sampleBlockSize);
                mp3buf = mp3encoder.encodeBuffer(leftChunk, rightChunk);
                if (mp3buf.length > 0) {
                    mp3Data.push(mp3buf);
                }
            }
            mp3buf = mp3encoder.flush();

            if (mp3buf.length > 0) {
                mp3Data.push(mp3buf);
            }
            console.log("Encoding finished");

            $scope.$apply(function(){
                ctrl.mp3Blob = new Blob(mp3Data, {type: 'audio/mpeg'});
                ctrl.mp3PreviewUrl = audioPreview.src = URL.createObjectURL(ctrl.mp3Blob);
                ctrl.mp3FileSize = bytesToSize(ctrl.mp3Blob.size);
            });
        }

        function userMediaStarted(stream){

            $scope.$apply(ctrl.recording = true);

            var audioContext = window.AudioContext || window.webkitAudioContext,
                context = new audioContext(),
                audioInput = context.createMediaStreamSource(stream);

            var recorder = context.createScriptProcessor(
                bufferSize,
                numChannels,
                numChannels
            );

            recorder.onaudioprocess = function(e){
                if(!ctrl.recording) return;
                var buffer = [];
                for (var channel = 0; channel < numChannels; channel++){
                    buffer.push(e.inputBuffer.getChannelData(channel));
                }
                window.recorderWorker.postMessage({
                    command: 'record',
                    buffer: buffer
                });
            };

            audioInput.connect(recorder);
            recorder.connect(context.destination);

            window.recorderWorker = new Worker(REC_WORKER_PATH);
            window.recorderWorker.postMessage({
                command: 'init',
                config: {
                    sampleRate: context.sampleRate,
                    numChannels: numChannels
                }
            });
            window.recorderWorker.onmessage = procesWavData;


        };

        function userMediaFailed(error){
            console.log("Error: ", error);
        };

        function cleanupRecording(){
            delete ctrl.mp3PreviewUrl;
            delete ctrl.mp3Blob;
        }

        this.uploadMp3 = function(){
            var reader = new FileReader();
            reader.onload = function(event){
                console.log("File event: ", event);
                var fd = new FormData();
                fd.append('data', event.target.result);

                $http.post(MP3_UPLOAD_URL, fd, {
                    transformRequest: angular.identity,
                    headers: {'Content-Type': undefined}
                }).success(function(response){
                    if(response.success){
                        console.log("Upload successfull");
                        cleanupRecording();
                    }
                    else{
                        console.log("Upload unsuccessfull: ", response.message);
                    }
                }).error(function(){
                    console.log("Upload failed");
                });
            };
            reader.readAsDataURL(ctrl.mp3Blob);

        };

        this.startRecording = function(){

            cleanupRecording();

            if(navigator.getUserMedia){
                navigator.getUserMedia({audio:true}, userMediaStarted, userMediaFailed);
            }
            else {
                console.log("getUserMedia not supported");
            }
        };

        this.stopRecording = function(){
            if(ctrl.recording){
                delete ctrl.recording;
                window.recorderWorker.postMessage({
                    command: 'getBuffer',
                    type: 'audio/wav'
                });
            }
        };

    }]);

})(window);
