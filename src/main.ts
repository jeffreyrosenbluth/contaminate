import { invoke } from "@tauri-apps/api/tauri";
import { dialog } from "@tauri-apps/api";
import GUI from "lil-gui";

const gui = new GUI();

let controls = {
  scale: 40.0,
  bias: 0.0,
  style: "Always",

  chooseImage: async function () {
    try {
      const file = await dialog.open({
        multiple: false,
        directory: false,
        filters: [
          {
            name: "Images",
            extensions: ["png", "jpeg", "jpg"],
          },
        ],
      });

      if (typeof file === "string") {
        try {
          await invoke("get_image", { path: file });
          const [width, height, img_data]: [number, number, Uint8Array] = await invoke("show_image");
          displayImage(width, height, img_data);
        } catch (error) {
          console.error(`Error: ${error}`);
        }
      }
    } catch (error) {
      console.error(`Error: ${error}`);
    }
  },

  generate: async function () {
    try {
      const [width, height, img_data]: [number, number, Uint8Array] = await invoke("gen_image", {
        scale: controls.scale,
        bias: controls.bias,
        style: controls.style,
      });
      displayImage(width, height, img_data);
    } catch (error) {
      console.error(`Error: ${error}`);
    }
  },

  save: async function () {
    try {
      const file = await dialog.save({
        defaultPath: "contaminated.png",
        filters: [
          {
            name: "PNG",
            extensions: ["png", "jpeg", "jpg"],
          },
        ],
      });
      if (typeof file === "string") {
        await invoke("save_image", {
          path: file,
        });
      }
    } catch (error) {
      console.error(`Error: ${error}`);
    }
  },
};

gui.add(controls, "scale", 0, 200).step(1).name("Scale");
gui.add(controls, "bias", -100, 100).step(1).name("Bias");
gui.add(controls, "style", ["Always", "Lightest", "Darkest"]).name("Style");
gui.add(controls, "chooseImage").name("Choose Image");
gui.add(controls, "generate").name("Contaminate");
gui.add(controls, "save").name("Save as PNG");

function displayImage(width: number, height: number, data: Uint8Array) {
  const canvas = document.querySelector('canvas') as HTMLCanvasElement;
  const aspect = width / height;
  const ctx = canvas.getContext('2d')
  canvas.height = width / aspect;
  let clamped_data = new Uint8ClampedArray(data);
  const img_data = new ImageData(clamped_data, width, height);
  const offCanvas = document.createElement('canvas');
  offCanvas.width = width;
  offCanvas.height = height;
  const offCtx = offCanvas.getContext('2d');
  if (offCtx) {
    offCtx.putImageData(img_data, 0, 0);
  }
  if (ctx) {
    ctx.drawImage(offCanvas, 0, 0, 1024, 1024 / aspect);
  }
}

document.addEventListener("keydown", (event) => {
  if (event.key === "c" || event.key === "C") {
    gui.show(gui._hidden);
  }
});
