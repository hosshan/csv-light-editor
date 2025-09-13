use std::fs::File;
use std::io::Write;
use std::path::Path;
use csv;
use encoding_rs::{Encoding, UTF_8};
use anyhow::{Result, Context};
use crate::csv_engine::reader::CsvData;

pub struct CsvWriter {
    delimiter: u8,
    encoding: &'static Encoding,
}

impl CsvWriter {
    pub fn new() -> Self {
        Self {
            delimiter: b',',
            encoding: UTF_8,
        }
    }

    pub fn with_delimiter(mut self, delimiter: u8) -> Self {
        self.delimiter = delimiter;
        self
    }

    pub fn with_encoding(mut self, encoding: &'static Encoding) -> Self {
        self.encoding = encoding;
        self
    }

    pub fn write_file(&self, path: &Path, data: &CsvData) -> Result<()> {
        let mut wtr = csv::WriterBuilder::new()
            .delimiter(self.delimiter)
            .from_writer(vec![]);

        if !data.headers.is_empty() {
            wtr.write_record(&data.headers)
                .context("Failed to write CSV headers")?;
        }

        for row in &data.rows {
            wtr.write_record(row)
                .context("Failed to write CSV row")?;
        }

        let csv_bytes = wtr.into_inner()
            .context("Failed to get CSV bytes")?;

        let encoded_data = if self.encoding == UTF_8 {
            csv_bytes
        } else {
            let text = String::from_utf8(csv_bytes)
                .context("Failed to convert CSV to string")?;
            let (encoded, _, _) = self.encoding.encode(&text);
            encoded.to_vec()
        };

        let mut file = File::create(path)
            .context("Failed to create output file")?;
        file.write_all(&encoded_data)
            .context("Failed to write to file")?;

        Ok(())
    }

    pub fn append_rows(&self, path: &Path, rows: &[Vec<String>]) -> Result<()> {
        let file = std::fs::OpenOptions::new()
            .write(true)
            .append(true)
            .open(path)
            .context("Failed to open file for appending")?;

        let mut wtr = csv::WriterBuilder::new()
            .delimiter(self.delimiter)
            .has_headers(false)
            .from_writer(file);

        for row in rows {
            wtr.write_record(row)
                .context("Failed to append row")?;
        }

        wtr.flush()
            .context("Failed to flush writer")?;

        Ok(())
    }
}