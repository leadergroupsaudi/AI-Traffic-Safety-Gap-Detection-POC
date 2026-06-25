import cv2
import os


class SnapshotExtractor:

    def __init__(self, video_path):

        self.video_path = video_path

    def extract_frame(
        self,
        timestamp_sec,
        output_path
    ):

        cap = cv2.VideoCapture(
            self.video_path
        )

        fps = cap.get(
            cv2.CAP_PROP_FPS
        )

        frame_number = int(
            timestamp_sec * fps
        )

        cap.set(
            cv2.CAP_PROP_POS_FRAMES,
            frame_number
        )

        success, frame = cap.read()

        if success:
            cv2.imwrite(
                output_path,
                frame
            )

        cap.release()

        return success