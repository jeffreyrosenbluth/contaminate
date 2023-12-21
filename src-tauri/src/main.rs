// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

// use base64::{engine::general_purpose, Engine as _};
use image::*;
use rand::{rngs::SmallRng, SeedableRng};
use rand_distr::{Distribution, Normal};
use serde::Deserialize;
use std::io::Cursor;
use std::sync::{Arc, Mutex};

struct State {
    in_image: Arc<Mutex<RgbaImage>>,
    out_image: Arc<Mutex<RgbaImage>>,
}

fn main() {
    let img = RgbaImage::from_fn(1024, 924, |w, h| {
        if w < 512 && h < 462 {
            Rgba([150, 55, 10, 255])
        } else if w > 512 && h > 462 {
            Rgba([140, 135, 165, 255])
        } else {
            Rgba([255, 255, 255, 255])
        }
    });
    tauri::Builder::default()
        .manage(State {
            in_image: Arc::new(Mutex::new(img.clone())),
            out_image: Arc::new(Mutex::new(img)),
        })
        .invoke_handler(tauri::generate_handler![
            gen_image, show_image, save_image, get_image
        ])
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

fn encode_rgba(image: &RgbaImage) -> Vec<u8> {
    let mut bytes = Vec::new();
    let mut cursor = Cursor::new(&mut bytes);
    image
        .write_to(&mut cursor, image::ImageOutputFormat::Png)
        .unwrap();
    cursor.into_inner().clone()
}

// fn encode_rgba(image: &RgbaImage) -> String {
//     let mut buf = Vec::new();
//     let mut cursor = Cursor::new(&mut buf);
//     let _ = image.write_to(&mut cursor, image::ImageOutputFormat::Png);
//     general_purpose::STANDARD.encode(&mut cursor.get_ref())
// }

#[tauri::command]
fn save_image(path: &str, state: tauri::State<State>) {
    let state_image = state.out_image.lock().unwrap();
    state_image.save(path).unwrap();
}

#[tauri::command]
fn get_image(path: &str, state: tauri::State<State>) {
    let in_img = image::open(path).unwrap();
    let mut state_in_image = state.in_image.lock().unwrap();
    *state_in_image = in_img.to_rgba8();
}

#[tauri::command]
fn show_image(state: tauri::State<State>) -> Vec<u8> {
    let state_image = state.in_image.lock().unwrap().clone();
    encode_rgba(&state_image)
}

#[tauri::command]
fn gen_image(scale: f32, bias: f32, style: Style, state: tauri::State<State>) -> Vec<u8> {
    let mut rng = SmallRng::seed_from_u64(0);
    let in_img = state.in_image.lock().unwrap().clone();
    let width = in_img.width() as i32;
    let height = in_img.height() as i32;
    let scale = match style {
        Style::Darkest => 2.0 * scale,
        Style::Lightest => 2.0 * scale,
        Style::Always => scale,
    };
    let normal = Normal::new(bias, scale * width as f32 / 4000.0).unwrap();
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
            out_img.put_pixel(x as u32, y as u32, *pixel);
        }
    }
    let mut state_image = state.out_image.lock().unwrap();
    *state_image = out_img.clone();
    encode_rgba(&out_img)
}
