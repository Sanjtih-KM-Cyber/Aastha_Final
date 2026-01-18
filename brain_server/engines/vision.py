import torch
from transformers import BlipProcessor, BlipForConditionalGeneration
from PIL import Image
import io

class VisionEngine:
    def __init__(self):
        print("[Vision] Loading BLIP model...")
        self.device = "cuda" if torch.cuda.is_available() else "cpu"
        self.processor = BlipProcessor.from_pretrained("Salesforce/blip-image-captioning-base")
        self.model = BlipForConditionalGeneration.from_pretrained("Salesforce/blip-image-captioning-base").to(self.device)
        print("[Vision] Model Loaded.")

    def analyze(self, image_bytes):
        try:
            image = Image.open(io.BytesIO(image_bytes)).convert('RGB')
            inputs = self.processor(image, return_tensors="pt").to(self.device)
            out = self.model.generate(**inputs)
            caption = self.processor.decode(out[0], skip_special_tokens=True)
            return caption
        except Exception as e:
            print(f"[Vision Error] {e}")
            return "An image I cannot quite make out."

vision_engine = VisionEngine()
