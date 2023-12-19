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
          const img: string = await invoke("get_image", { path: file });
          const img_data: string = await invoke("show_image", { data: img });
          displayImage(img_data);
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
      const img_data: string = await invoke("gen_image", {
        scale: controls.scale,
        bias: controls.bias,
        style: controls.style,
      });
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
