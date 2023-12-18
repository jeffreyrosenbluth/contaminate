// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use base64::{engine::general_purpose, Engine as _};
use image::*;
use rand::{rngs::SmallRng, SeedableRng};
use rand_distr::{Distribution, Normal};
use serde::Deserialize;
use std::io::Cursor;
use std::sync::Mutex;

struct State {
    image: Mutex<RgbaImage>,
}

fn main() {
    tauri::Builder::default()
        .manage(State {
            image: Mutex::new(RgbaImage::new(0, 0)),
        })
        .invoke_handler(tauri::generate_handler![gen_image, show_image, save_image])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

#[allow(dead_code)]
#[derive(Deserialize)]
enum Style {
    Darkest,
    Lightest,
    Always,
}

fn encode_rgba(image: &RgbaImage) -> String {
    let mut buf = Vec::new();
    let mut cursor = Cursor::new(&mut buf);
    let _ = image.write_to(&mut cursor, image::ImageOutputFormat::Png);
    general_purpose::STANDARD.encode(&mut cursor.get_ref())
}

#[tauri::command]
fn save_image(path: &str, state: tauri::State<State>) {
    let state_image = state.image.lock().unwrap();
    state_image.save(path).unwrap();
}

#[tauri::command]
fn show_image(path: &str, state: tauri::State<State>) -> String {
    let in_img = image::open(path).unwrap();
    let mut state_image = state.image.lock().unwrap();
    *state_image = in_img.as_rgba8().unwrap().clone();
    encode_rgba(&in_img.into_rgba8())
}

#[tauri::command]
fn gen_image(
    path: &str,
    scale: f32,
    bias: f32,
    style: Style,
    state: tauri::State<State>,
) -> String {
    let mut rng = SmallRng::seed_from_u64(0);
    let in_img = image::open(path).unwrap();
    let width = in_img.width() as i32;
    let height = in_img.height() as i32;
    let scale = match style {
        Style::Darkest => 2.0 * scale,
        Style::Lightest => 2.0 * scale,
        Style::Always => scale,
    };
    let normal = Normal::new(bias, scale * width as f32 / 4000.0).unwrap();
    let mut out_image = image::RgbaImage::new(in_img.width(), in_img.height());
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
            };
            out_image.put_pixel(x as u32, y as u32, pixel);
        }
    }
    let mut state_image = state.image.lock().unwrap();
    *state_image = out_image.clone();
    encode_rgba(&out_image)
}
