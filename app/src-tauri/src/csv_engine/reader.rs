use std::fs::File;
use std::io::{BufReader, Read};
use std::path::Path;
use csv;
use encoding_rs::{Encoding, UTF_8};
use chardet;
use anyhow::{Result, Context};
use serde::{Deserialize, Serialize};
use crate::metadata::CsvMetadata;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CsvData {
    pub headers: Vec<String>,
    pub rows: Vec<Vec<String>>,
    pub metadata: CsvMetadata,
}

pub struct CsvReader {
    delimiter: u8,
    has_headers: bool,
    encoding: &'static Encoding,
}

impl CsvReader {
    pub fn new() -> Self {
        Self {
            delimiter: b',',
            has_headers: true,
            encoding: UTF_8,
        }
    }

    pub fn with_delimiter(mut self, delimiter: u8) -> Self {
        self.delimiter = delimiter;
        self
    }

    pub fn with_headers(mut self, has_headers: bool) -> Self {
        self.has_headers = has_headers;
        self
    }

    pub fn with_encoding(mut self, encoding: &'static Encoding) -> Self {
        self.encoding = encoding;
        self
    }

    pub fn detect_encoding(&mut self, path: &Path) -> Result<&'static Encoding> {
        let mut file = File::open(path)?;
        let mut buffer = vec![0; 8192];
        let bytes_read = file.read(&mut buffer)?;
        buffer.truncate(bytes_read);

        let result = chardet::detect(&buffer);
        let encoding_name = result.0.as_str();

        self.encoding = match encoding_name.to_lowercase().as_str() {
            "utf-8" | "ascii" => UTF_8,
            "shift_jis" | "shift-jis" | "sjis" => encoding_rs::SHIFT_JIS,
            "euc-jp" | "eucjp" => encoding_rs::EUC_JP,
            "gb18030" | "gb2312" | "gbk" => encoding_rs::GB18030,
            _ => UTF_8,
        };

        Ok(self.encoding)
    }

    pub fn detect_delimiter(&mut self, path: &Path) -> Result<u8> {
        let file = File::open(path)?;
        let mut reader = BufReader::new(file);
        let mut buffer = vec![0; 1024];
        let bytes_read = reader.read(&mut buffer)?;
        buffer.truncate(bytes_read);

        let common_delimiters = vec![b',', b'\t', b';', b'|'];
        let mut delimiter_counts = vec![0; common_delimiters.len()];

        for (i, &delim) in common_delimiters.iter().enumerate() {
            delimiter_counts[i] = buffer.iter().filter(|&&b| b == delim).count();
        }

        let max_index = delimiter_counts
            .iter()
            .position(|&count| count == *delimiter_counts.iter().max().unwrap())
            .unwrap_or(0);

        self.delimiter = common_delimiters[max_index];
        Ok(self.delimiter)
    }

    pub fn read_file(&mut self, path: &Path) -> Result<CsvData> {
        // Always detect encoding and delimiter from the file
        self.detect_encoding(path)?;
        self.detect_delimiter(path)?;

        let file = File::open(path).context("Failed to open CSV file")?;
        let mut reader = BufReader::new(file);
        let mut buffer = Vec::new();
        reader.read_to_end(&mut buffer)?;

        let (decoded, _, _) = self.encoding.decode(&buffer);
        let text = decoded.into_owned();

        let mut csv_reader = csv::ReaderBuilder::new()
            .delimiter(self.delimiter)
            .has_headers(self.has_headers)
            .from_reader(text.as_bytes());

        let headers: Vec<String> = if self.has_headers {
            csv_reader
                .headers()
                .context("Failed to read CSV headers")?
                .iter()
                .map(|s| s.to_string())
                .collect()
        } else {
            Vec::new()
        };

        let mut rows: Vec<Vec<String>> = Vec::new();
        for result in csv_reader.records() {
            let record = result.context("Failed to read CSV record")?;
            let row: Vec<String> = record.iter().map(|s| s.to_string()).collect();
            rows.push(row);
        }

        let mut metadata = CsvMetadata::new(path)?;
        metadata.delimiter = String::from_utf8_lossy(&[self.delimiter]).to_string();
        metadata.encoding = self.encoding.name().to_string();
        metadata.has_headers = self.has_headers;
        metadata.update_counts(rows.len(), if !headers.is_empty() { headers.len() } else if !rows.is_empty() { rows[0].len() } else { 0 });

        Ok(CsvData {
            headers,
            rows,
            metadata,
        })
    }

    pub fn read_chunk(&mut self, path: &Path, start_row: usize, end_row: usize) -> Result<Vec<Vec<String>>> {
        let file = File::open(path)?;
        let mut reader = BufReader::new(file);
        let mut buffer = Vec::new();
        reader.read_to_end(&mut buffer)?;

        let (decoded, _, _) = self.encoding.decode(&buffer);
        let text = decoded.into_owned();

        let mut csv_reader = csv::ReaderBuilder::new()
            .delimiter(self.delimiter)
            .has_headers(self.has_headers)
            .from_reader(text.as_bytes());

        let mut rows: Vec<Vec<String>> = Vec::new();
        for (index, result) in csv_reader.records().enumerate() {
            if index < start_row {
                continue;
            }
            if index >= end_row {
                break;
            }

            let record = result?;
            let row: Vec<String> = record.iter().map(|s| s.to_string()).collect();
            rows.push(row);
        }

        Ok(rows)
    }
}