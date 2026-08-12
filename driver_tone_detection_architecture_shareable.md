# Driver Tone Detection --- ML Architecture

## 1. Objective

Build a driver-radio tone detection system that takes a driver's audio
clip and predicts the driver's emotional state.

For the initial implementation, we will train the model on **speech
emotions** using CREMA-D and map the predicted emotions to our
application's three driver states:

-   **Calm**
-   **Stressed**
-   **Tired**

This is the first practical version; the model is not being trained
directly on clinical stress/fatigue labels.

------------------------------------------------------------------------

## 2. Dataset

### CREMA-D

We will use the CREMA-D speech emotion dataset:

**Hugging Face:**\
https://huggingface.co/datasets/cfahlgren1/crema-d

CREMA-D provides:

-   7,442 audio clips
-   91 actors
-   6 emotion classes
-   Emotion label for every audio clip

### Emotion classes

``` text
Angry
Disgust
Fear
Happy
Neutral
Sad
```

For our current application we will use an initial mapping such as:

``` text
Angry   → Stressed
Fear    → Stressed
Neutral → Calm
Happy   → Calm
Sad     → Tired
Disgust → Tired / Stressed
```

------------------------------------------------------------------------

# 3. Overall Approach

We are using **transfer learning**.

We do NOT train a large speech model from scratch.

Instead:

``` text
Raw Audio
    ↓
Preprocessing
    ↓
Pretrained WavLM
    ↓
Audio Embedding Sequence
    ↓
Our Trainable Model
    ├── BiLSTM
    ├── Attention
    └── Linear Classifier
    ↓
Emotion Prediction
    ↓
Calm / Stressed / Tired
```

------------------------------------------------------------------------

# 4. Pretrained Audio Encoder --- WavLM

We will use:

**WavLM-Base-Plus**

Hugging Face:\
https://huggingface.co/microsoft/wavlm-base-plus

WavLM is already pretrained on large-scale speech data.

We will initially keep WavLM **frozen**.

Its job is:

``` text
Audio
  ↓
WavLM
  ↓
Speech representations
```

The important point is that WavLM does not give us just one vector for
the complete audio.

It produces a **sequence of embeddings over time**.

Conceptually:

``` text
Audio
 ↓
WavLM
 ↓
E1, E2, E3, E4, ... ET
```

Each `Ei` is a feature vector representing a portion of the audio.

For WavLM-Base-Plus, the hidden representation is 768-dimensional, so an
audio clip can be represented approximately as:

``` text
T × 768
```

where `T` depends on the audio duration.

------------------------------------------------------------------------

# 5. Creating Our Training Data

We first run every training audio through WavLM.

Instead of repeatedly processing the raw audio during training, we save
the embeddings.

So our dataset becomes:

``` text
X = WavLM embedding sequence
Y = emotion label
```

Example:

``` text
Sample 1:

X = [E1, E2, E3, ... ET]
Y = Angry
```

``` text
Sample 2:

X = [E1, E2, E3, ... ET]
Y = Happy
```

The embeddings can be cached as `.pt` files.

``` text
embeddings/
    sample_001.pt
    sample_002.pt
    sample_003.pt
    ...
```

This makes training much faster because WavLM only needs to be run once
during feature extraction.

------------------------------------------------------------------------

# 6. BiLSTM --- Temporal Modeling

## Input

The BiLSTM receives the **sequence of WavLM embeddings**:

``` text
E1 → E2 → E3 → ... → ET
```

It does not receive the emotion label as an input.

## What it does

WavLM gives us a representation of each part of the speech.

The BiLSTM learns how those representations **change and relate to each
other over time**.

For example:

``` text
normal voice
     ↓
slightly tense
     ↓
increasing energy
     ↓
high energy
```

The BiLSTM learns representations of such temporal patterns.

### Input

``` text
T × 768
```

### Output

For example, with:

``` text
hidden_size = 128
bidirectional = True
```

the output becomes:

``` text
T × 256
```

because:

``` text
128 forward
+
128 backward
=
256
```

The output is another sequence:

``` text
H1, H2, H3, ... HT
```

These are **contextualized representations** --- each representation
contains information about the temporal context around that point in the
audio.

------------------------------------------------------------------------

# 7. Attention --- Selecting Important Information

The BiLSTM produces:

``` text
H1, H2, H3, ... HT
```

Not every time step is equally useful for deciding the emotion.

Attention learns which parts of the sequence are more useful.

Conceptually:

``` text
H1  → low importance
H2  → low importance
H3  → medium importance
...
H63 → high importance
H64 → very high importance
H65 → high importance
...
HT  → low importance
```

Attention then creates a weighted representation:

``` text
Context Vector =
a1H1 + a2H2 + ... + aTHT
```

The result is **one vector summarizing the audio while emphasizing the
most relevant temporal information**.

For example:

``` text
T × 256
   ↓
Attention
   ↓
256-dimensional context vector
```

------------------------------------------------------------------------

# 8. Classification Head

The attention output is passed to a Linear layer.

``` text
Context Vector
      ↓
Linear Layer
      ↓
6 logits
```

One logit corresponds to each emotion:

``` text
Angry
Disgust
Fear
Happy
Neutral
Sad
```

Example:

``` text
Angry     = 3.2
Disgust   = 0.4
Fear      = 0.7
Happy     = 0.2
Neutral   = 0.1
Sad       = -0.3
```

These are scores, not probabilities.

------------------------------------------------------------------------

# 9. Softmax

Softmax converts the logits into probabilities:

``` text
Logits
  ↓
Softmax
  ↓
Emotion probabilities
```

Example:

``` text
Angry     = 0.73
Disgust   = 0.04
Fear      = 0.08
Happy     = 0.05
Neutral   = 0.06
Sad       = 0.04
```

Final prediction:

``` text
Angry
```

Softmax itself has no trainable weights.

------------------------------------------------------------------------

# 10. What Exactly Do We Train?

### Pretrained / initially frozen

``` text
WavLM
```

### Trainable

``` text
BiLSTM
Attention
Linear classifier
```

### Not separately trained

``` text
Softmax
```

The trainable model is therefore:

``` text
WavLM embeddings
        ↓
      BiLSTM
        ↓
     Attention
        ↓
      Linear
        ↓
     Softmax
```

------------------------------------------------------------------------

# 11. How Training Works

For every sample:

``` text
Embedding sequence
        ↓
      BiLSTM
        ↓
     Attention
        ↓
      Linear
        ↓
      Logits
        ↓
     Softmax
        ↓
   Prediction
```

The prediction is compared with the dataset's true label using:

``` text
Cross Entropy Loss
```

Then:

``` text
Prediction + True Label
          ↓
         Loss
          ↓
   Backpropagation
          ↓
Update:
  BiLSTM weights
  Attention weights
  Linear weights
```

The label is therefore used as the **training target**, not as an input
to the BiLSTM or Attention.

------------------------------------------------------------------------

# 12. Why This Architecture?

### WavLM

Provides strong pretrained speech representations.

### BiLSTM

Learns temporal relationships in the speech representation.

``` text
"What is happening across time?"
```

### Attention

Selects the most useful parts of the temporal sequence.

``` text
"Which moments matter most?"
```

### Linear + Softmax

Converts the learned representation into an emotion prediction.

``` text
"What emotion does this representation correspond to?"
```

------------------------------------------------------------------------

# 13. Complete ML Pipeline

``` text
                    RAW DRIVER AUDIO
                           │
                           ▼
                    PREPROCESSING
                    16 kHz / Mono
                           │
                           ▼
                    PRETRAINED WavLM
                       (Frozen)
                           │
                           ▼
                 EMBEDDING SEQUENCE
                      T × 768
                           │
                           ▼
                        BiLSTM
                     128 × 2 hidden
                           │
                           ▼
                CONTEXTUAL SEQUENCE
                      T × 256
                           │
                           ▼
                       ATTENTION
                           │
                           ▼
                  CONTEXT VECTOR
                      256-d
                           │
                           ▼
                   LINEAR CLASSIFIER
                       256 → 6
                           │
                           ▼
                        LOGITS
                           │
                           ▼
                       SOFTMAX
                           │
                           ▼
                 EMOTION PROBABILITIES
                           │
                           ▼
                 DRIVER STATE MAPPING
                           │
              ┌────────────┼────────────┐
              ▼            ▼            ▼
            CALM       STRESSED       TIRED
```

------------------------------------------------------------------------

# 14. Hackathon Implementation Strategy

Because we have a **3-day constraint**, we will separate the expensive
feature extraction from model training.

## Stage 1 --- One-time feature extraction

``` text
CREMA-D audio
      ↓
WavLM
      ↓
Save embeddings
```

## Stage 2 --- Fast experimentation

``` text
Saved embeddings
      ↓
BiLSTM
      ↓
Attention
      ↓
Linear
```

We can quickly experiment with:

-   hidden size
-   learning rate
-   dropout
-   batch size
-   number of epochs

without repeatedly running WavLM.

## Stage 3 --- Integration

``` text
Trained model
      ↓
FastAPI backend
      ↓
Audio upload
      ↓
Prediction
      ↓
Timestamp
      ↓
Lap data
      ↓
Frontend visualization
```

------------------------------------------------------------------------

# 15. Computational Cost

This architecture is **manageable for the 3-day hackathon**.

The main computationally expensive component is:

``` text
Raw audio → WavLM → embeddings
```

The custom model:

``` text
BiLSTM → Attention → Linear
```

is comparatively lightweight.

The main optimization is therefore:

> **Run WavLM once, cache the embeddings, and train the BiLSTM +
> Attention + classifier using the cached embeddings.**

We should use a GPU for WavLM feature extraction if one is available.

We should avoid repeatedly running WavLM during every training epoch.

------------------------------------------------------------------------

# 16. Final Architecture Summary

### Input

``` text
Driver radio audio
```

### Feature extraction

``` text
Pretrained WavLM
```

### Custom learned architecture

``` text
BiLSTM
   ↓
Attention
   ↓
Linear Classifier
```

### Output

``` text
Emotion probability
```

### Application mapping

``` text
Emotion
   ↓
Calm / Stressed / Tired
```

### Later integration

``` text
Driver State
      +
Timestamp
      +
Lap Number
      +
Lap Time
      ↓
Race-performance visualization
```

------------------------------------------------------------------------

## Key Idea

We are **not building a new speech encoder**.

We are taking a pretrained speech encoder and building our own
task-specific temporal architecture on top of it:

``` text
Pretrained knowledge
       ↓
      WavLM
       ↓
Our learned temporal understanding
       ↓
     BiLSTM
       ↓
Our learned attention mechanism
       ↓
    Attention
       ↓
Our classifier
       ↓
    Emotion
       ↓
Driver State
```

This gives us a model that is realistic to implement within the
hackathon while still having a meaningful custom ML component.
