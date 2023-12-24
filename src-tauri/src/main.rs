// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use image::*;
use rand::{rngs::SmallRng, SeedableRng};
use rand_distr::{Distribution, Normal};
use serde::{Deserialize, Serialize};
use std::sync::Mutex;

const W: f32 = 1024.0;

// Shared state for the tauri app.
struct State {
    base_image: Mutex<RgbaImage>,
}

// Data to send to the js side for rendering the image.
#[derive(Serialize)]
struct Picture {
    width: u32,
    height: u32,
    data: Vec<u8>,
}

fn main() {
    tauri::Builder::default()
        .manage(State {
            base_image: Mutex::new(RgbaImage::new(0, 0)),
        })
        .invoke_handler(tauri::generate_handler![gen_image, save_image, get_image])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

// Choose between always keeping the modified pixel, the average of
// the new and original pixel coloe, or only if its
// lighter or darker than the original pixel.
#[allow(dead_code)]
#[derive(Deserialize)]
enum Style {
    Darkest,
    Lightest,
    Always,
    Mix,
}

#[tauri::command]
fn save_image(path: &str, scale: f32, style: Style, state: tauri::State<State>) {
    let gen = generate(scale, style, state);
    let _ = gen.save(path);
}

// Open the image and store it in the global state.
// Scale it to the canvas size before sending it to the js side.
#[tauri::command]
fn get_image(path: &str, state: tauri::State<State>) -> Picture {
    let img = match image::open(path) {
        Ok(img) => img,
        Err(err) => {
            eprintln!("The file at {} could not be opened: {}", path, err);
            DynamicImage::new_rgba8(0, 0)
        }
    };
    let mut state_base_image = state.base_image.lock().expect("Could not lock state mutex");
    *state_base_image = img.to_rgba8();
    let scale = W / img.width() as f32;
    let nwidth = (img.width() as f32 * scale) as u32;
    let nhight = (img.height() as f32 * scale) as u32;
    let new_img = imageops::resize(&img, nwidth, nhight, imageops::FilterType::Lanczos3);
    Picture {
        width: nwidth,
        height: nhight,
        data: new_img.into_vec(),
    }
}

// Run the conatimate alogoritm 'generat' and send the scaled result to the
// frontend.
#[tauri::command]
fn gen_image(scale: f32, style: Style, state: tauri::State<State>) -> Picture {
    let img = generate(scale, style, state);
    let scale = W / img.width() as f32;
    let nwidth = (img.width() as f32 * scale) as u32;
    let nhight = (img.height() as f32 * scale) as u32;
    let new_img = imageops::resize(&img, nwidth, nhight, imageops::FilterType::Lanczos3);
    Picture {
        width: nwidth,
        height: nhight,
        data: new_img.into_vec(),
    }
}

// The contaminate algorithm.
fn generate(scale: f32, style: Style, state: tauri::State<State>) -> RgbaImage {
    let mut rng = SmallRng::seed_from_u64(0);
    let in_img = state
        .base_image
        .lock()
        .expect("Could not lock state mutex")
        .clone();
    let width = in_img.width() as i32;
    let height = in_img.height() as i32;
    let scale = match style {
        Style::Darkest => 2.5 * scale,
        Style::Lightest => 2.5 * scale,
        Style::Always => scale,
        Style::Mix => 2.5 * scale,
    };
    let normal = Normal::new(0.0, scale * width as f32 / 4000.0)
        .expect("Could not create normal distribution");
    let mut out_img = image::RgbaImage::new(in_img.width(), in_img.height());
    for x in 0..width {
        for y in 0..height {
            let delta_x = normal.sample(&mut rng).round() as i32;
            let delta_y = normal.sample(&mut rng).round() as i32;
            let x1 = if x + delta_x >= width {
                (x - delta_x).clamp(0, width - 1)
            } else {
                (x + delta_x).clamp(0, width - 1)
            };
            let y1 = if y + delta_y >= height {
                (y - delta_y).clamp(0, height - 1)
            } else {
                (y + delta_y).clamp(0, height - 1)
            };

            let old_pixel = in_img.get_pixel(x as u32, y as u32);
            let new_pixel = in_img.get_pixel(x1 as u32, y1 as u32);
            let pxl = &new_pixel.map2(old_pixel, |x, y| (x as f32 * 0.5 + y as f32 * 0.5) as u8);
            let pixel = match style {
                Style::Darkest => {
                    if new_pixel.to_luma()[0] < old_pixel.to_luma()[0] {
                        new_pixel
                    } else {
                        old_pixel
                    }
                }
                Style::Lightest => {
                    if new_pixel.to_luma()[0] > old_pixel.to_luma()[0] {
                        new_pixel
                    } else {
                        old_pixel
                    }
                }
                Style::Always => new_pixel,
                Style::Mix => pxl,
            };
            out_img.put_pixel(x as u32, y as u32, *pixel);
        }
    }
    out_img
}
