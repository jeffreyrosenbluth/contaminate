import { invoke } from "@tauri-apps/api/tauri";
import { dialog } from "@tauri-apps/api";
import GUI from "lil-gui";

interface Picture {
  width: number;
  height: number;
  data: Uint8Array;
}

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
            extensions: ["png", "jpeg", "jpg", "tiff", "webp"],
          },
        ],
      });

      if (typeof file === "string") {
        try {
          const picture: Picture = await invoke("get_image", {
            path: file,
            scale: controls.scale,
            bias: controls.bias,
            style: controls.style,
          });
          displayImage(picture.width, picture.height, picture.data);
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
      const picture: Picture = await invoke("gen_image", {
        scale: controls.scale,
        bias: controls.bias,
        style: controls.style,
      });
      displayImage(picture.width, picture.height, picture.data);
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
          scale: controls.scale,
          bias: controls.bias,
          style: controls.style,
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
  const canvas = document.querySelector("canvas") as HTMLCanvasElement;
  const aspect = width / height;
  const ctx = canvas.getContext("2d");
  canvas.height = 1024 / aspect;
  let clamped_data = new Uint8ClampedArray(data);
  const img_data = new ImageData(clamped_data, width, height);
  ctx!.putImageData(img_data, 0, 0);
}

document.addEventListener("keydown", (event) => {
  if (event.key === "c" || event.key === "C") {
    gui.show(gui._hidden);
  }
});
