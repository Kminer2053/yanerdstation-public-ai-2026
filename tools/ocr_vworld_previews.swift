import Foundation
import Vision
import AppKit

struct OcrItem: Codable {
    let path: String
    let text: String
    let lines: [String]
    let averageConfidence: Double
}

guard CommandLine.arguments.count == 3 else {
    FileHandle.standardError.write(Data("usage: ocr_vworld_previews <input-list.txt> <output.json>\n".utf8))
    exit(2)
}

let listPath = CommandLine.arguments[1]
let outputPath = CommandLine.arguments[2]
let paths = try String(contentsOfFile: listPath, encoding: .utf8)
    .split(separator: "\n")
    .map(String.init)
    .filter { !$0.isEmpty }

var output: [OcrItem] = []
for (index, path) in paths.enumerated() {
    autoreleasepool {
        guard let image = NSImage(contentsOfFile: path),
              let data = image.tiffRepresentation,
              let bitmap = NSBitmapImageRep(data: data),
              let cgImage = bitmap.cgImage else {
            output.append(OcrItem(path: path, text: "", lines: [], averageConfidence: 0))
            return
        }

        let request = VNRecognizeTextRequest()
        request.recognitionLevel = .accurate
        request.usesLanguageCorrection = true
        request.recognitionLanguages = ["ko-KR", "en-US"]
        request.minimumTextHeight = 0.005

        do {
            try VNImageRequestHandler(cgImage: cgImage, options: [:]).perform([request])
            let observations = request.results ?? []
            let candidates = observations.compactMap { $0.topCandidates(1).first }
            let lines = candidates.map { $0.string.trimmingCharacters(in: .whitespacesAndNewlines) }
                .filter { !$0.isEmpty }
            let confidence = candidates.isEmpty ? 0 : candidates.map { Double($0.confidence) }.reduce(0, +) / Double(candidates.count)
            output.append(OcrItem(path: path, text: lines.joined(separator: " | "), lines: lines, averageConfidence: confidence))
        } catch {
            if index < 3 {
                FileHandle.standardError.write(Data("OCR error for \(path): \(error)\n".utf8))
            }
            output.append(OcrItem(path: path, text: "", lines: [], averageConfidence: 0))
        }
    }

    if (index + 1) % 50 == 0 || index + 1 == paths.count {
        print("{\"processed\":\(index + 1),\"total\":\(paths.count)}")
        fflush(stdout)
    }
}

let encoder = JSONEncoder()
encoder.outputFormatting = [.prettyPrinted, .sortedKeys]
try encoder.encode(output).write(to: URL(fileURLWithPath: outputPath))
