import { invoke } from "@tauri-apps/api/tauri";
import { dialog } from "@tauri-apps/api";
import GUI from "lil-gui";

const gui = new GUI();

let filePath: string;
let img_data: string;

async function genImage(file: string) {
  img_data = await invoke("gen_image", {
    path: file,
    scale: controls.scale,
    bias: controls.bias,
    style: controls.style,
  });
}

let controls = {
  scale: 20.0,
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
        filePath = file;
        try {
          let data: string = await invoke("show_image", { path: file });
          displayImage(data);
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
      await genImage(filePath);
      displayImage(img_data);
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
          data: img_data,
        });
      }
    } catch (error) {
      console.error(`Error: ${error}`);
    }
  },
};

gui.add(controls, "scale", 0, 100).step(1).name("Scale");
gui.add(controls, "bias", -50, 50).step(1).name("Bias");
gui.add(controls, "style", ["Always", "Lightest", "Darkest"]).name("Style");
gui.add(controls, "chooseImage").name("Choose Image");
gui.add(controls, "generate").name("Contaminate");
gui.add(controls, "save").name("Save as PNG");

function displayImage(base64Image: string) {
  const imageElement = document.getElementById(
    "processedImage"
  ) as HTMLImageElement;
  imageElement.src = `data:image/png;base64,${base64Image}`;
}

document.addEventListener("keydown", (event) => {
  if (event.key === "c" || event.key === "C") {
    gui.show(gui._hidden);
  }
});
