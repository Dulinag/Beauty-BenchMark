(()=>{const e=document.getElementById("video");Promise.all([faceapi.nets.ssdMobilenetv1.loadFromUri("/models"),faceapi.nets.faceLandmark68Net.loadFromUri("/models")]).then((async function(){try{for(;;){const e=await o(t,a);if(0===e.length){console.log("No more image ratings to process.");break}console.log(`Processing batch starting from index ${a}`),await n(e),a+=t}}catch(e){console.error("Error analyzing images:",e)}}));const t=1e4;let a=0;async function o(e,t){try{const a="/labels/All_Ratings.xlsx",o=await fetch(a).then((e=>e.arrayBuffer())),n=XLSX.read(o,{type:"array"}),r=n.SheetNames[0],i=n.Sheets[r];return XLSX.utils.sheet_to_json(i).slice(t,t+e).map((({Filename:e,Ratings:t})=>({filename:`/labels/Images/${e}.jpg`,rating:t})))}catch(e){throw console.error("Error reading Excel file:",e),e}}async function n(e){for(const{filename:t,rating:a}of e)await r(t,a)}async function r(e,t){return new Promise(((a,o)=>{const n=new Image;n.src=e,n.onload=async()=>{const o=await faceapi.detectAllFaces(n).withFaceLandmarks();if(o.length>0){const n=o[0],{landmarks:r}=n,i=(r.getMouth(),r.getLeftEye(),r.getRightEye(),r.getLeftEyeBrow(),void r.getRightEyeBrow());console.log(`Image: ${e}, Actual Rating: ${t}, Detected Rating: ${i}`),a()}else console.log(`No faces detected in image ${e}`),a()},n.onerror=t=>{console.error(`Error loading image ${e}:`,t),o(t)}}))}e.addEventListener("play",(async()=>{const t=faceapi.createCanvasFromMedia(e);document.body.append(t);const a={width:e.width,height:e.height};faceapi.matchDimensions(t,a),setInterval((async()=>{const o=await faceapi.detectAllFaces(e).withFaceLandmarks(),n=faceapi.resizeResults(o,a);t.getContext("2d").clearRect(0,0,t.width,t.height),n.forEach((e=>{const{landmarks:a}=e,o=(a.getMouth(),a.getLeftEye(),a.getRightEye(),a.getLeftEyeBrow(),void a.getRightEyeBrow()),n=e.detection.box;new faceapi.draw.DrawBox(n,{label:o.toString()}).draw(t)}))}),100)}))})();