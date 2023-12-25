import { invoke } from "@tauri-apps/api/tauri";
import { dialog } from "@tauri-apps/api";
import GUI from "lil-gui";

interface Picture {
  width: number;
  height: number;
  data: Uint8Array;
}

type GradientStyle =
  | "None"
  | "Horizontal"
  | "Vertical"
  | { Radial: [number, number] };

function makeGradient(): GradientStyle {
  switch (controls.gradient) {
    case "None":
      return "None";
    case "Horizontal":
      return "Horizontal";
    case "Vertical":
      return "Vertical";
    case "Radial":
      return {
        Radial: [controls.centerX, controls.centerY],
      };
  }
}

const W = 1024;
const gui = new GUI();

// Open an image and save it to the global state.
// Then display it in the main window.
async function chooseImage() {
  try {
    // Query the user for the filepath.
    const file = (await dialog.open({
      multiple: false,
      directory: false,
      filters: [
        {
          name: "Images",
          extensions: ["png", "jpeg", "jpg", "tiff", "webp"],
        },
      ],
    })) as string;

    // Open and save the image to the global state.
    try {
      const picture: Picture = await invoke("get_image", {
        path: file,
        scale: controls.scale,
        style: controls.style,
      });
      // If the image exists show it in the window.
      displayImage(picture.width, picture.height, picture.data);
    } catch (error) {
      // If the image file could not be opened, display an error.
      displayError(error as Error);
    }
  } catch (error) {
    console.error(`Error: ${error}`);
  }
}

// Contaminate the input image.
async function generate() {
  try {
    // Run the contamination algorithm on the input image.
    const picture: Picture = await invoke("gen_image", {
      scale: controls.scale,
      style: controls.style,
      grad: makeGradient(),
      reverse: controls.reverse,
    });
    // Show the contaminated image in the window.
    displayImage(picture.width, picture.height, picture.data);
  } catch (error) {
    console.error(`Error: ${error}`);
  }
}

// Save the image as a png. The image size will match the
// original input image.
async function save() {
  try {
    const file = (await dialog.save({
      defaultPath: "contaminated.png",
      filters: [
        {
          name: "PNG",
          extensions: ["png", "jpeg", "jpg"],
        },
      ],
    })) as string;
    await invoke("save_image", {
      path: file,
      scale: controls.scale,
      style: controls.style,
      grad: makeGradient(),
      reverse: controls.reverse,
    });
  } catch (error) {
    console.error(`Error: ${error}`);
  }
}

// Controls for the gui, two sliders a picker and 3 buttons.
let controls = {
  scale: 50.0,
  style: "Always",
  gradient: "None" as "None" | "Horizontal" | "Vertical" | "Radial",
  reverse: false,
  centerX: 0.5,
  centerY: 0.5,
  chooseImage: async function () {
    chooseImage();
  },
  generate: async function () {
    generate();
  },
  save: async function () {
    save();
  },
};

// Setup the gui.
gui.add(controls, "scale", 0, 300, 1).name("Scale");
gui
  .add(controls, "style", ["Always", "Lightest", "Darkest", "Mix"])
  .name("Style");
gui
  .add(controls, "gradient", ["None", "Horizontal", "Vertical", "Radial"])
  .name("Gradient Style");
const dataFolder = gui.addFolder("Gradient Center");
dataFolder.add(controls, "centerX", 0, 1, 0.05);
dataFolder.add(controls, "centerY", 0, 1, 0.05);
dataFolder.domElement.style.display = "none";
gui.onChange(() => {
  dataFolder.domElement.style.display =
    controls.gradient === "Radial" ? "" : "none";
});
gui.add(controls, "reverse").name("Reverse");
gui.add(controls, "chooseImage").name("Choose Image");
gui.add(controls, "generate").name("Contaminate");
gui.add(controls, "save").name("Save as PNG");

// Convert the raw image data to a canvas image and put it on the canvas.
function displayImage(width: number, height: number, data: Uint8Array) {
  const splash = document.getElementById("splash");
  splash!.style.display = "none";
  const errorElement = document.getElementById("error-message");
  if (errorElement instanceof HTMLElement) {
    errorElement.textContent = "";
    errorElement.style.display = "none";
  }
  const canvas = document.querySelector("canvas") as HTMLCanvasElement;
  canvas.style.display = "block";
  const aspect = width / height;
  const ctx = canvas.getContext("2d");
  canvas.height = W / aspect;
  let clamped_data = new Uint8ClampedArray(data);
  const img_data = new ImageData(clamped_data, width, height);
  ctx!.putImageData(img_data, 0, 0);
}

function displayError(error: Error) {
  const splash = document.getElementById("splash");
  splash!.style.display = "none";
  const canvas = document.querySelector("canvas") as HTMLCanvasElement;
  canvas.style.display = "none";
  const errorElement = document.getElementById("error-message");
  if (errorElement instanceof HTMLElement) {
    errorElement.textContent = error.toString();
    errorElement.style.display = "block";
  }
}

// Toggle the control panel.
document.addEventListener("keydown", (event) => {
  if (event.key === "c" || event.key === "C") {
    gui.show(gui._hidden);
  }
});
