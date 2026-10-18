"""CNN architectures for satellite patch classification."""

import tensorflow as tf


def build_baseline(input_shape):
    """Regularized CNN baseline for calibrated satellite patch experiments.

    The architecture stays intentionally small for a reproducible pilot. It adds
    spatial dropout and a second normalization stage, but does not claim better
    accuracy until trained and evaluated on a real, independent test split.
    """
    inputs = tf.keras.Input(shape=input_shape, name="satellite_patch")
    x = tf.keras.layers.Conv2D(32, 3, padding="same", activation="relu")(inputs)
    x = tf.keras.layers.BatchNormalization()(x)
    x = tf.keras.layers.MaxPooling2D()(x)
    x = tf.keras.layers.Conv2D(64, 3, padding="same", activation="relu")(x)
    x = tf.keras.layers.BatchNormalization()(x)
    x = tf.keras.layers.MaxPooling2D()(x)
    x = tf.keras.layers.Conv2D(128, 3, padding="same", activation="relu")(x)
    x = tf.keras.layers.BatchNormalization()(x)
    x = tf.keras.layers.SpatialDropout2D(0.2)(x)
    x = tf.keras.layers.GlobalAveragePooling2D()(x)
    x = tf.keras.layers.Dropout(0.35)(x)
    outputs = tf.keras.layers.Dense(1, activation="sigmoid", name="hotspot_score")(x)
    model = tf.keras.Model(inputs, outputs, name="satellite_hotspot_cnn_baseline")
    model.compile(optimizer=tf.keras.optimizers.Adam(1e-3),
                  loss="binary_crossentropy", metrics=["accuracy"])
    return model