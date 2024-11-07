/* eslint-disable no-param-reassign */
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
    const lightboxBoxStartButton = document.createElement('button');
    lightboxBoxStartButton.classList.add('buttons__button--confirm');
    lightboxBoxStartButton.classList.add('buttons__button');
    lightboxBoxStartButton.textContent = 'Start';
    const lightboxBoxDenyButton = document.createElement('button');
    lightboxBoxDenyButton.classList.add('buttons__button--deny');
    lightboxBoxDenyButton.classList.add('buttons__button');
    lightboxBoxDenyButton.textContent = 'Cancel';

    // AEB Value selector
    const aebStepInput = document.createElement('input');
    aebStepInput.type = 'number';
    aebStepInput.value = this.config.aebStep;
    aebStepInput.classList.add('aeb-step-input');
    aebStepInput.placeholder = 'AEB Step';
    lightboxBoxContent.appendChild(aebStepInput);

    lightboxBoxContent.style.height = '430px';
    lightboxBoxContent.style.padding = '20px';

    document.body.appendChild(lightbox);
    lightbox.appendChild(lightboxBox);
    lightbox.appendChild(lightboxClose);
    lightboxBox.appendChild(lightboxBoxContent);
    lightboxBox.appendChild(lightboxBoxButtons);
    lightboxBoxButtons.appendChild(lightboxBoxDenyButton);
    lightboxBoxButtons.appendChild(lightboxBoxStartButton);

    // Spinner setup
    const spinner = document.createElement('div');
    spinner.classList.add('spinner');
    spinner.style.display = 'none';
    lightboxBoxContent.appendChild(spinner);

    lightboxClose.addEventListener('click', () => {
      document.body.removeChild(lightbox);
    });

    // lightboxBoxStartButton.addEventListener('click', () => {
    //   console.log(this.config.fileExtension, this.config.fileExtension);
    //   this.mainCanvas.toBlob(async (blob) => {
    //     const now = new Date();
    //     const datetime = now.toISOString().replace(/[-:T]/g, '').slice(0, 14);

    //     await this.saveAs(
    //       blob,
    //       `${datetime}-average.${this.config.fileExtension}`,
    //     );
    //     document.body.removeChild(lightbox);
    //   }, this.config.mimeType);
    // });

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
          const blueImage = canvases[set * 3 * groupSize + 2 * groupSize + i];

          const redCtx = redImage
            .getContext('2d')
            .getImageData(0, 0, width, height);
          const greenCtx = greenImage
            .getContext('2d')
            .getImageData(0, 0, width, height);
          const blueCtx = blueImage
            .getContext('2d')
            .getImageData(0, 0, width, height);

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
        numGroups: numGroups / 3,
      };
    }

    // Create Save Button
    const createSaveButton = (canvas, index) => {
      const saveButton = document.createElement('button');
      saveButton.textContent = `Save Image ${index + 1}`;
      saveButton.classList.add('buttons__button', 'buttons__button--confirm');

      saveButton.addEventListener('click', () => {
        canvas.toBlob(async (blob) => {
          const now = new Date();
          const datetime = now.toISOString().replace(/[-:T]/g, '').slice(0, 14);

          await this.saveAs(
            blob,
            `${datetime}-group-${index + 1}.${this.config.fileExtension}`,
          );
        }, this.config.mimeType);
      });

      return saveButton;
    };

    // Create Rotate Button
    const createRotateButton = (canvas, label, angle) => {
      const rotateButton = document.createElement('button');
      rotateButton.textContent = label;
      rotateButton.classList.add('buttons__button');

      rotateButton.addEventListener('click', () => {
        const tempCanvas = document.createElement('canvas');
        const tempCtx = tempCanvas.getContext('2d');

        // Rotate canvas
        const width = canvas.width;
        const height = canvas.height;

        if (angle === 90 || angle === -270) {
          tempCanvas.width = height;
          tempCanvas.height = width;
          tempCtx.translate(height, 0);
        } else if (angle === -90 || angle === 270) {
          tempCanvas.width = height;
          tempCanvas.height = width;
          tempCtx.translate(0, width);
        } else {
          tempCanvas.width = width;
          tempCanvas.height = height;
        }

        tempCtx.rotate((angle * Math.PI) / 180);
        tempCtx.drawImage(canvas, 0, 0);

        // Replace canvas content
        canvas.width = tempCanvas.width;
        canvas.height = tempCanvas.height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(tempCanvas, 0, 0);
      });

      return rotateButton;
    };

    // Display averaged groups
    const displayGroups = (groupResults) => {
      const scaleFactor = this.config.scaleFactor || 4;

      groupResults.forEach((groupCanvas, index) => {
        const container = document.createElement('div');
        container.classList.add('canvas-container');

        const resultCanvas = document.createElement('canvas');
        resultCanvas.width = groupCanvas.width * scaleFactor;
        resultCanvas.height = groupCanvas.height * scaleFactor;
        const resultCtx = resultCanvas.getContext('2d');
        resultCtx.imageSmoothingEnabled = false;

        resultCtx.drawImage(
          groupCanvas,
          0, 0,
          resultCanvas.width,
          resultCanvas.height,
        );

        // Set Styling
        resultCanvas.style.display = 'block';
        resultCanvas.style.width = '100%';
        resultCanvas.style.maxWidth = '440px';
        resultCanvas.style.margin = '0 auto';

        // Append canvas and buttons
        container.appendChild(resultCanvas);
        container.appendChild(createSaveButton(resultCanvas, index));
        container.appendChild(createRotateButton(resultCanvas, 'Rotate Left', -90));
        container.appendChild(createRotateButton(resultCanvas, 'Rotate Right', 90));

        lightboxBoxContent.appendChild(container);
      });
    };

    const process = () => Promise.all(
      images.map((image) => image.getCanvas({
        scaleFactor: 1, // this.config.scaleFactor || 4,
      })),
    )
      .then((canvases) => {
        // RGB Merge
        const rgbMergedImages = mergeRGBImages(canvases, parseFloat(aebStepInput.value));

        return rgbMergedImages;
      })
      .then(({ canvases, groupSize, numGroups }) => {
        const scaleFactor = this.config.scaleFactor || 4;

        const groupResults = [];

        for (let i = 0; i < numGroups; i++) {
          const groupStart = i * groupSize;
          const groupCanvases = canvases.slice(groupStart, groupStart + groupSize);

          // Create a temporary canvas for group averaging
          const tempCanvas = document.createElement('canvas');
          tempCanvas.width = groupCanvases[0].width;
          tempCanvas.height = groupCanvases[0].height;
          const tempCtx = tempCanvas.getContext('2d');

          groupCanvases.forEach((canvas, index) => {
            tempCtx.globalAlpha = 1 / (index + 1);
            tempCtx.drawImage(canvas, 0, 0);
          });

          groupResults.push(tempCanvas);
        }

        return displayGroups(groupResults);

        // canvases.forEach((canvas, index) => {
        //   if (index === 0) {
        //     // Set up the main canvas to be scaled according to the scaleFactor
        //     this.mainCanvas = document.createElement('canvas');
        //     this.mainCanvas.width = canvas.width * scaleFactor;
        //     this.mainCanvas.height = canvas.height * scaleFactor;
        //     this.mainCanvasCtx = this.mainCanvas.getContext('2d');

        //     // Disable smoothing for nearest-neighbor scaling
        //     this.mainCanvasCtx.imageSmoothingEnabled = false;

        //     // Append the scaled main canvas to the lightbox content
        //     lightboxBoxContent.appendChild(this.mainCanvas);
        //     this.mainCanvas.style.display = 'block';
        //     this.mainCanvas.style.width = '100%';
        //     this.mainCanvas.style.maxWidth = '440px';
        //     this.mainCanvas.style.margin = '0 auto';

        //     // Draw the first canvas onto the main canvas, scaled by the factor
        //     this.mainCanvasCtx.drawImage(
        //       canvas,
        //       0,
        //       0,
        //       this.mainCanvas.width,
        //       this.mainCanvas.height,
        //     );
        //   } else {
        //     // Adjust the global alpha for blending
        //     this.mainCanvasCtx.globalAlpha = 1 / (index + 1);

        //     // Draw each subsequent image onto the scaled canvas
        //     this.mainCanvasCtx.drawImage(
        //       canvas,
        //       0,
        //       0,
        //       this.mainCanvas.width,
        //       this.mainCanvas.height,
        //     );
        //   }
        // });
      });

    lightboxBoxStartButton.addEventListener('click', () => {
      lightboxBoxContent.style.display = 'none'; // Hide selector
      lightboxBoxStartButton.disabled = true; // Disable start button
      spinner.style.display = 'block'; // Show spinner

      process()
        .then(() => {
          spinner.style.display = 'none'; // Hide spinner
          lightboxBoxContent.style.display = 'block'; // Show results
        })
        .catch((error) => {
          console.error('Processing failed:', error);
          spinner.style.display = 'none'; // Hide spinner on error
          lightboxBoxContent.style.display = 'block'; // Allow retry
        });
    });

  }
}

window.gbpwRegisterPlugin(DummyPlugin);
