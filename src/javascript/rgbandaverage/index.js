/* eslint-disable no-mixed-operators */
/* eslint-disable no-plusplus */
class DummyPlugin {
  constructor({ saveAs, progress, store: { dispatch } }, config) {
    this.name = 'RGBAndAverage';
    this.description =
      'Automatically RGB merges and creates an average over a set of images';
    this.configParams = {
      scaleFactor: {
        label: 'Image export dimension factor (1x, 2x, ...)',
        type: 'number',
      },
      fileExtension: {
        label: 'Filetype: Use "png", "jpg" or "webp"',
        type: 'string',
      },
      aebStep: {
        label: 'The AEB step setting that was used to shoot the pictures',
        type: 'number',
      },
    };

    // will be updated via setConfig()
    this.config = {};
    this.setConfig(config);

    // saveAs is a reference to the saveAs method from https://www.npmjs.com/package/file-saver
    // progress should be called with values between 0 and 1 to indicate plugin progress
    // both values should be stored as follows:
    this.saveAs = saveAs;
    this.progress = progress;
    this.dispatch = dispatch;
    this.mainCanvas = null;
    this.mainCanvasCtx = null;
  }

  showMessage(label) {
    this.dispatch({
      type: 'CONFIRM_ASK',
      payload: {
        message: this.name,
        questions: () => [
          {
            label,
            key: 'info',
            type: 'info',
          },
        ],
        confirm: () => {
          this.dispatch({
            type: 'CONFIRM_ANSWERED',
          });
        },
      },
    });
  }

  setConfig(configUpdate) {
    Object.assign(this.config, configUpdate);

    switch (configUpdate.fileExtension?.toLowerCase()) {
      case 'jpg':
      case 'jpeg':
        this.config.fileExtension = 'jpg';
        this.config.mimeType = 'image/jpeg';
        break;
      case 'webp':
        this.config.fileExtension = 'webp';
        this.config.mimeType = 'image/webp';
        break;
      case 'png':
      default:
        this.config.fileExtension = 'png';
        this.config.mimeType = 'png';
        break;
    }
  }

  withImage() {
    this.showMessage(`${this.name} is needs to be run over a set of images`);
  }

  withSelection(images) {
    const lightbox = document.createElement('div');
    lightbox.classList.add('lightbox');
    const lightboxBox = document.createElement('div');
    lightboxBox.classList.add('lightbox__box');
    const lightboxClose = document.createElement('button');
    lightboxClose.classList.add('lightbox__backdrop');
    const lightboxBoxContent = document.createElement('div');
    lightboxBoxContent.classList.add('lightbox__box-content');
    const lightboxBoxButtons = document.createElement('div');
    lightboxBoxButtons.classList.add('buttons');
    const lightboxBoxSaveButton = document.createElement('button');
    lightboxBoxSaveButton.classList.add('buttons__button--confirm');
    lightboxBoxSaveButton.classList.add('buttons__button');
    lightboxBoxSaveButton.textContent = 'Download';
    const lightboxBoxDenyButton = document.createElement('button');
    lightboxBoxDenyButton.classList.add('buttons__button--deny');
    lightboxBoxDenyButton.classList.add('buttons__button');
    lightboxBoxDenyButton.textContent = 'Cancel';

    lightboxBoxContent.style.height = '430px';
    lightboxBoxContent.style.padding = '20px';

    document.body.appendChild(lightbox);
    lightbox.appendChild(lightboxBox);
    lightbox.appendChild(lightboxClose);
    lightboxBox.appendChild(lightboxBoxContent);
    lightboxBox.appendChild(lightboxBoxButtons);
    lightboxBoxButtons.appendChild(lightboxBoxDenyButton);
    lightboxBoxButtons.appendChild(lightboxBoxSaveButton);

    lightboxClose.addEventListener('click', () => {
      document.body.removeChild(lightbox);
    });

    lightboxBoxSaveButton.addEventListener('click', () => {
      console.log(this.config.fileExtension, this.config.fileExtension);
      this.mainCanvas.toBlob(async (blob) => {
        const now = new Date();
        const datetime = now.toISOString().replace(/[-:T]/g, '').slice(0, 14);

        await this.saveAs(
          blob,
          `${datetime}-average.${this.config.fileExtension}`,
        );
        document.body.removeChild(lightbox);
      }, this.config.mimeType);
    });

    lightboxBoxDenyButton.addEventListener('click', () => {
      document.body.removeChild(lightbox);
    });

    function mergeRGBImages(canvases, aebStep) {
      const groupSize = aebStep * 2 + 1; // The number of images per color group
      const numGroups = canvases.length / groupSize;

      // Abort if images can't be divided into groups properly
      if (numGroups % 3 !== 0 || !Number.isInteger(numGroups / 3)) {
        console.error(
          'Images cannot be evenly divided into RGB groups. Check the input.',
        );
        return null;
      }

      const rgbMergedImages = [];

      for (let set = 0; set < numGroups / 3; set++) {
        const group = [];

        // For each image in the group
        for (let i = 0; i < groupSize; i++) {
          const width = canvases[0].width;
          const height = canvases[0].height;

          // Create a new canvas for each image in the group
          const outputCanvas = document.createElement('canvas');
          outputCanvas.width = width;
          outputCanvas.height = height;
          const outputCtx = outputCanvas.getContext('2d');
          const outputImageData = outputCtx.createImageData(width, height);

          // Retrieve the R, G, and B images from the current group
          const redImage = canvases[set * 3 * groupSize + i];
          const greenImage = canvases[set * 3 * groupSize + groupSize + i];
          const blueImage = canvases[set * 3 * groupSize + (2 * groupSize) + i];

          const redCtx = redImage.getContext('2d').getImageData(0, 0, width, height);
          const greenCtx = greenImage.getContext('2d').getImageData(0, 0, width, height);
          const blueCtx = blueImage.getContext('2d').getImageData(0, 0, width, height);

          // Copy the RGB data to the output image without averaging
          for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
              const index = (y * width + x) * 4;

              // Assign RGB values from respective channels without averaging
              outputImageData.data[index] = redCtx.data[index]; // Red channel
              outputImageData.data[index + 1] = greenCtx.data[index + 1]; // Green channel
              outputImageData.data[index + 2] = blueCtx.data[index + 2]; // Blue channel
              outputImageData.data[index + 3] = 255; // Full opacity
            }
          }

          // Draw the modified image data to the output canvas
          outputCtx.putImageData(outputImageData, 0, 0);
          group.push(outputCanvas);
        }

        rgbMergedImages.push(...group);
      }

      return {
        canvases: rgbMergedImages,
        groupSize,
        numGroups,
      };
    }

    Promise.all(
      images.map((image) => image.getCanvas({
        scaleFactor: 1, // this.config.scaleFactor || 4,
      })),
    )
      .then((canvases) => {
        // RGB Merge
        const rgbMergedImages = mergeRGBImages(canvases, this.config.aebStep);

        return rgbMergedImages;
      })
      .then(({ canvases, groupSize, numGroups }) => {
        const scaleFactor = this.config.scaleFactor || 4;

        canvases.forEach((canvas, index) => {
          if (index === 0) {
            // Set up the main canvas to be scaled according to the scaleFactor
            this.mainCanvas = document.createElement('canvas');
            this.mainCanvas.width = canvas.width * scaleFactor;
            this.mainCanvas.height = canvas.height * scaleFactor;
            this.mainCanvasCtx = this.mainCanvas.getContext('2d');

            // Disable smoothing for nearest-neighbor scaling
            this.mainCanvasCtx.imageSmoothingEnabled = false;

            // Append the scaled main canvas to the lightbox content
            lightboxBoxContent.appendChild(this.mainCanvas);
            this.mainCanvas.style.display = 'block';
            this.mainCanvas.style.width = '100%';
            this.mainCanvas.style.maxWidth = '440px';
            this.mainCanvas.style.margin = '0 auto';

            // Draw the first canvas onto the main canvas, scaled by the factor
            this.mainCanvasCtx.drawImage(
              canvas,
              0,
              0,
              this.mainCanvas.width,
              this.mainCanvas.height,
            );
          } else {
            // Adjust the global alpha for blending
            this.mainCanvasCtx.globalAlpha = 1 / (index + 1);

            // Draw each subsequent image onto the scaled canvas
            this.mainCanvasCtx.drawImage(
              canvas,
              0,
              0,
              this.mainCanvas.width,
              this.mainCanvas.height,
            );
          }
        });
      });
  }
}

window.gbpwRegisterPlugin(DummyPlugin);
