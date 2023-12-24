import { invoke } from "@tauri-apps/api/tauri";
import { dialog } from "@tauri-apps/api";
import GUI from "lil-gui";

interface Picture {
  width: number;
  height: number;
  data: Uint8Array;
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
    const picture: Picture = await invoke("get_image", {
      path: file,
      scale: controls.scale,
      style: controls.style,
    });

    // Show the image in the window.
    displayImage(picture.width, picture.height, picture.data);
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
    });
  } catch (error) {
    console.error(`Error: ${error}`);
  }
}

// Controls for the gui, two sliders a picker and 3 buttons.
let controls = {
  scale: 50.0,
  style: "Always",
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
gui.add(controls, "scale", 0, 200).step(1).name("Scale");
gui
  .add(controls, "style", ["Always", "Lightest", "Darkest", "Mix"])
  .name("Style");
gui.add(controls, "chooseImage").name("Choose Image");
gui.add(controls, "generate").name("Contaminate");
gui.add(controls, "save").name("Save as PNG");

// Convert the raw image data to a canvas image and put it on the canvas.
function displayImage(width: number, height: number, data: Uint8Array) {
  const canvas = document.querySelector("canvas") as HTMLCanvasElement;
  const aspect = width / height;
  const ctx = canvas.getContext("2d");
  canvas.height = W / aspect;
  let clamped_data = new Uint8ClampedArray(data);
  const img_data = new ImageData(clamped_data, width, height);
  ctx!.putImageData(img_data, 0, 0);
}

// Toggle the control panel.
document.addEventListener("keydown", (event) => {
  if (event.key === "c" || event.key === "C") {
    gui.show(gui._hidden);
  }
});
