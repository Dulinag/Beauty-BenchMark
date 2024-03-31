const batchSize = 20; // Define batchSize outside the function
let currentBatchIndex = 0; // Define currentBatchIndex outside the function
let imageRatings = []; // Define imageRatings array to store all image ratings

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


async function startAnalysis() {
  try {
    console.log("Starting image analysis...");
    imageRatings = await getImageRatingsFromExcelInBatches(batchSize, currentBatchIndex);
    await startWebcam();
    await analyzeImages();
    console.log("Image analysis completed successfully!");
  } catch (error) {
    console.error("Error analyzing images:", error);
  }
}

function startWebcam() {
  return navigator.mediaDevices
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

async function getImageRatingsFromExcelInBatches(batchSize, startIndex) {
  try {
    const file = "/labels/All_Ratings.xlsx";
    console.log("Fetching file:", file);
    const arrayBuffer = await fetch(file).then(response => response.arrayBuffer());
    console.log("File fetched successfully!");
    const workbook = XLSX.read(arrayBuffer, { type: "array" });
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const data = XLSX.utils.sheet_to_json(worksheet);
    return data.slice(startIndex, startIndex + batchSize).map(({ Filename, Rating }) => ({
      filename: `/labels/Images/${Filename}`,
      rating: Rating
    }));
  } catch (error) {
    console.error("Error reading Excel file:", error);
    throw error;
  }
}

async function analyzeImages() {
  while (true) {
    console.log("Current batch index:", currentBatchIndex);
    if (imageRatings.length === 0) {
      console.log("No more image ratings to process.");
      break;
    }
    await processBatch();
    currentBatchIndex += batchSize;
    imageRatings = await getImageRatingsFromExcelInBatches(batchSize, currentBatchIndex);
  }
}

async function processBatch() {
  for (const { filename, rating } of imageRatings) {
    await analyzeImage(filename, rating);
  }
}

async function analyzeImage(filename, imageRating) {
  try {
    const imageUrl = `${filename}`;
    const img = await loadImage(imageUrl);
    const detections = await faceapi.detectAllFaces(img).withFaceLandmarks();
    if (detections.length > 0) {
      detections.forEach((detection) => {
        const { landmarks } = detection;
        const mouth = landmarks.getMouth();
        const leftEye = landmarks.getLeftEye();
        const rightEye = landmarks.getRightEye();
        const leftEyebrow = landmarks.getLeftEyeBrow();
        const rightEyebrow = landmarks.getRightEyeBrow();

        const expressionScores = calculateExpressionScores(mouth, leftEye, rightEye, leftEyebrow, rightEyebrow, detection);
        const detectedRating = getDetectedRating(expressionScores, imageRating);
        const matchThreshold = 0.2;

        // Draw the detected rating on the canvas
        const canvas = document.getElementById("canvas");
        const ctx = canvas.getContext("2d");
        ctx.font = "16px Arial";
        ctx.fillStyle = "white";
        ctx.fillText(`Rating: ${detectedRating}`, detection.detection.box.x, detection.detection.box.y - 10);

        // Optionally, you can draw a rectangle around the detected face
        ctx.strokeStyle = "red";
        ctx.lineWidth = 2;
        ctx.strokeRect(detection.detection.box.x, detection.detection.box.y, detection.detection.box.width, detection.detection.box.height);

        // Check if the detected rating matches the image rating within the match threshold
        if (Math.abs(detectedRating - imageRating) <= matchThreshold) {
          // If matched, you can optionally draw a green border around the face
          ctx.strokeStyle = "green";
          ctx.strokeRect(detection.detection.box.x, detection.detection.box.y, detection.detection.box.width, detection.detection.box.height);
        } else {
          // If not matched, you can optionally draw a red border around the face
          ctx.strokeStyle = "red";
          ctx.strokeRect(detection.detection.box.x, detection.detection.box.y, detection.detection.box.width, detection.detection.box.height);
        }
      });
    } else {
      console.log(`No faces detected in image ${imageUrl}`);
    }
  } catch (error) {
    console.error(`Error analyzing image ${filename}:`, error);
  }
}


async function loadImage(url) {
  try {
    const img = new Image();
    img.src = url;
    await new Promise((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = (error) => reject(error);
    });
    return img;
  } catch (error) {
    throw new Error(`Error loading image from ${url}: ${error.message}`);
  }

}

// Define a function to calculate detected rating based on expression scores
// Define a function to calculate detected rating based on expression scores
// Adjusted getDetectedRating function with modified weights
function getDetectedRating(expressionScores, actualRating) {
  const { smileScore, eyeOpennessScore, eyebrowHeightScore } = expressionScores;

  // Combine the expression scores using weighted averages
  let detectedRating = (smileScore * 0.4 + eyeOpennessScore * 0.3 + eyebrowHeightScore * 0.3) * actualRating;

  // Ensure that the detected rating falls within the range of 1 to 5
  detectedRating = Math.min(Math.max(detectedRating, 1), 5);

  // Round the detected rating to a reasonable precision (e.g., 2 decimal places)
  detectedRating = Math.round(detectedRating * 100) / 100;

  return detectedRating;
}


// Calculate expression scores based on facial landmarks
function calculateExpressionScores(mouth, leftEye, rightEye, leftEyebrow, rightEyebrow, detection) {
  const faceWidth = detection.detection.box.width; // Assuming faceWidth is the width of the detected face
  const smileScore = calculateSmileScore(mouth, faceWidth);
  const eyeOpennessScore = calculateEyeOpennessScore(leftEye, rightEye);
  const eyebrowHeightScore = calculateEyebrowHeightScore(leftEyebrow, rightEyebrow);
  return { smileScore, eyeOpennessScore, eyebrowHeightScore };
}
// Normalize the smile score to a range between 0 and 1
function calculateSmileScore(mouth, faceWidth) {
  const mouthWidth = Math.abs(mouth[6].x - mouth[0].x); // Distance between mouth corners
  const minSmileWidth = 0.3 * faceWidth; // Minimum threshold for a smile (30% of face width)
  const maxSmileWidth = 0.6 * faceWidth; // Maximum threshold for a wide smile (60% of face width)

  let smileScore;
  if (mouthWidth >= maxSmileWidth) {
    smileScore = 1; // Maximum smile score for wide smile
  } else if (mouthWidth >= minSmileWidth) {
    smileScore = (mouthWidth - minSmileWidth) / (maxSmileWidth - minSmileWidth); // Linearly interpolate between thresholds
  } else {
    smileScore = 0; // No smile or minimal smile
  }

  // Ensure that the smile score falls within the range of 0 and 1
  return Math.min(Math.max(smileScore, 0), 1);

  
}

// Calculate eye openness score based on eye aspect ratio (EAR)
function calculateEyeOpennessScore(leftEye, rightEye) {
  const leftEAR = calculateEAR(leftEye);
  const rightEAR = calculateEAR(rightEye);
  const eyeOpennessScore = (leftEAR + rightEAR) / 2; // Average EAR of both eyes

  // Normalize the score to a range between 0 and 1
  const normalizedScore = Math.min(Math.max(eyeOpennessScore, 0), 1);
  return normalizedScore;
}

// Calculate EAR (Eye Aspect Ratio) for a single eye
function calculateEAR(eyeLandmarks) {
  const eyeHeight = Math.abs(eyeLandmarks[1].y - eyeLandmarks[4].y); // Vertical distance
  const eyeWidth = Math.abs(eyeLandmarks[0].x - eyeLandmarks[3].x); // Horizontal distance
  return eyeHeight / eyeWidth;
}

// Calculate eyebrow height score based on eyebrow position
function calculateEyebrowHeightScore(leftEyebrow, rightEyebrow) {
  const leftEyebrowHeight = leftEyebrow[0].y - Math.min(leftEyebrow[1].y, leftEyebrow[2].y); // Vertical distance
  const rightEyebrowHeight = rightEyebrow[0].y - Math.min(rightEyebrow[1].y, rightEyebrow[2].y); // Vertical distance
  const averageEyebrowHeight = (leftEyebrowHeight + rightEyebrowHeight) / 2; // Average height

  // Normalize the average eyebrow height to a score between 0 and 1
  const normalizedScore = Math.min(Math.max(averageEyebrowHeight / 100, 0), 1); // Assuming a typical face width of 100 units
  return normalizedScore;
}
// Adjust the getFaceRating function to consider these new scores
// Adjust the getFaceRating function to consider these new scores
function getFaceRating(expressionScores, actualRating) {
  // Example implementation to calculate face rating based on expression scores and actual rating
  // You can combine the expression scores with the actual rating and assign weights to each factor
  // to compute the overall face rating

  // You can define weights for each score based on their importance
  const smileWeight = 0.4;
  const eyeOpennessWeight = 0.3;
  const eyebrowHeightWeight = 0.3;

  // Calculate the weighted sum of expression scores
  let weightedSum = expressionScores.smileScore * smileWeight +
                     expressionScores.eyeOpennessScore * eyeOpennessWeight +
                     expressionScores.eyebrowHeightScore * eyebrowHeightWeight;

  // Scale the weighted sum to the range of actual ratings (1 to 5)
  weightedSum = (weightedSum * (actualRating - 1) / 5) + 1;

  // Ensure that the weighted sum falls within the range of 1 to 5
  weightedSum = Math.min(Math.max(weightedSum, 1), 5);

  // Round the weighted sum to the nearest integer
  return Math.round(weightedSum);
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
    const detections = await faceapi.detectAllFaces(video).withFaceLandmarks();

    const resizedDetections = faceapi.resizeResults(detections, displaySize);

    canvas.getContext("2d").clearRect(0, 0, canvas.width, canvas.height);

    if (resizedDetections.length > 0) {
      resizedDetections.forEach(async (detection) => {
        const { landmarks } = detection;
        const mouth = landmarks.getMouth();
        const leftEye = landmarks.getLeftEye();
        const rightEye = landmarks.getRightEye();
        const leftEyebrow = landmarks.getLeftEyeBrow();
        const rightEyebrow = landmarks.getRightEyeBrow();

        const expressionScores = calculateExpressionScores(mouth, leftEye, rightEye, leftEyebrow, rightEyebrow, detection); // Calculate expression scores
        const actualRating = 5; // Replace this with the actual rating for the image
        const rating = getFaceRating(expressionScores, actualRating); // Calculate overall face rating based on expression scores and actual rating

        const box = detection.detection.box;
        const drawBox = new faceapi.draw.DrawBox(box, { label: rating.toString() });
        drawBox.draw(canvas);
      });
    }
  }, 100);
});
