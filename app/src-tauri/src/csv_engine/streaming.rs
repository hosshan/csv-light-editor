use std::fs::File;
use std::io::{BufRead, BufReader};
use std::path::Path;
use csv;
use encoding_rs::{Encoding, UTF_8};
use anyhow::{Result, Context};

pub struct StreamingReader {
    path: std::path::PathBuf,
    delimiter: u8,
    has_headers: bool,
    encoding: &'static Encoding,
    chunk_size: usize,
}

impl StreamingReader {
    pub fn new(path: &Path) -> Self {
        Self {
            path: path.to_path_buf(),
            delimiter: b',',
            has_headers: true,
            encoding: UTF_8,
            chunk_size: 1000,
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

    pub fn with_chunk_size(mut self, size: usize) -> Self {
        self.chunk_size = size;
        self
    }

    pub fn read_headers(&self) -> Result<Vec<String>> {
        let file = File::open(&self.path)
            .context("Failed to open file for streaming")?;
        let reader = BufReader::new(file);

        let mut lines = reader.lines();
        if let Some(first_line) = lines.next() {
            let line = first_line?;
            let decoded = if self.encoding == UTF_8 {
                line
            } else {
                let bytes = line.as_bytes();
                let (decoded, _, _) = self.encoding.decode(bytes);
                decoded.to_string()
            };

            let mut rdr = csv::ReaderBuilder::new()
                .delimiter(self.delimiter)
                .has_headers(false)
                .from_reader(decoded.as_bytes());

            if let Some(result) = rdr.records().next() {
                let record = result?;
                return Ok(record.iter().map(|s| s.to_string()).collect());
            }
        }

        Ok(Vec::new())
    }

    pub fn stream_chunks<F>(&self, mut callback: F) -> Result<()>
    where
        F: FnMut(Vec<Vec<String>>) -> Result<bool>,
    {
        let file = File::open(&self.path)?;
        let mut reader = csv::ReaderBuilder::new()
            .delimiter(self.delimiter)
            .has_headers(self.has_headers)
            .from_reader(file);

        let mut chunk = Vec::with_capacity(self.chunk_size);

        for result in reader.records() {
            let record = result?;
            let row: Vec<String> = record.iter().map(|s| s.to_string()).collect();
            chunk.push(row);

            if chunk.len() >= self.chunk_size {
                let should_continue = callback(chunk.clone())?;
                if !should_continue {
                    break;
                }
                chunk.clear();
            }
        }

        if !chunk.is_empty() {
            callback(chunk)?;
        }

        Ok(())
    }

    pub fn count_rows(&self) -> Result<usize> {
        let file = File::open(&self.path)?;
        let reader = BufReader::new(file);
        let mut count = 0;

        for line in reader.lines() {
            let _ = line?;
            count += 1;
        }

        if self.has_headers && count > 0 {
            count -= 1;
        }

        Ok(count)
    }

    pub fn estimate_memory_usage(&self) -> Result<u64> {
        let metadata = std::fs::metadata(&self.path)?;
        let file_size = metadata.len();

        let overhead_factor = 2;
        let estimated_memory = file_size * overhead_factor;

        Ok(estimated_memory)
    }
}