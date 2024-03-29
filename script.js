const video = document.getElementById("video");

Promise.all([
  faceapi.nets.ssdMobilenetv1.loadFromUri("/models"),
  faceapi.nets.faceLandmark68Net.loadFromUri("/models"),
]).then(startWebcam);

function startWebcam() {
  navigator.mediaDevices
    .getUserMedia({
      video: true,
      audio: false,
    })
    .then((stream) => {
      video.srcObject = stream;
    })
    .catch((error) => {
      console.error(error);
    });
}

// Define the calculateSmileScore function
function calculateSmileScore(mouth) {
  const mouthWidth = distance(mouth[0], mouth[6]);
  const mouthHeight = distance(mouth[3], mouth[9]);
  const aspectRatio = mouthWidth / mouthHeight;
  
  return aspectRatio;
}

// Define the getFaceRating function
function getFaceRating(smileScore, detection) {
  const faceSize = detection.detection.box.width * detection.detection.box.height;
  const smileWeight = 0.6; // Adjusted smile weight
  const sizeWeight = 0.4; // Adjusted size weight

  // Calculate rating based on smile score and face size
  let rating = (smileWeight * smileScore) + (sizeWeight * faceSize);

  // Map the rating to a range between 1 and 10
  rating = Math.round((rating / 10000) * 10); // Adjusted scaling factor

  // Ensure rating is within the range of 1-10
  rating = Math.max(1, Math.min(10, rating));

  return rating;
}

  

// Define the distance function
function distance(point1, point2) {
  const dx = point1.x - point2.x;
  const dy = point1.y - point2.y;
  return Math.sqrt(dx * dx + dy * dy);
}

video.addEventListener("play", async () => {
  const canvas = faceapi.createCanvasFromMedia(video);
  document.body.append(canvas);

  const displaySize = { width: video.width, height: video.height };
  faceapi.matchDimensions(canvas, displaySize);

  setInterval(async () => {
    const detections = await faceapi
      .detectAllFaces(video)
      .withFaceLandmarks();

    const resizedDetections = faceapi.resizeResults(detections, displaySize);

    canvas.getContext("2d").clearRect(0, 0, canvas.width, canvas.height);

    if (resizedDetections.length > 0) { // Check if detections array is not empty
      resizedDetections.forEach(detection => {
        const { landmarks } = detection;
        const mouth = landmarks.getMouth();

        const smileScore = calculateSmileScore(mouth);
        const rating = getFaceRating(smileScore, detection); // Calculate overall face rating based on smile and other factors

        const box = detection.detection.box;
        const drawBox = new faceapi.draw.DrawBox(box, { label: rating.toString() });
        drawBox.draw(canvas);
      });
    }
  }, 100);
});
