# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [1.4.0] - 2025-11-23

### Added
- Extracted mock matching logic into isolated, testable utility functions (`src/utils/mock-matcher.ts`)
- Comprehensive unit tests for mock matching logic (27 test cases)
- `generateRequestKey()` utility function for creating unique request identifiers
- `isExactMatch()` utility function for exact request matching
- `isSimilarPathMatch()` utility function for path-based matching
- `doRequiredParamsMatch()` utility function for required parameter validation
- `findBestMatchingMock()` utility function for finding best matching mock

### Fixed
- Fixed infinite loop issue when `useSimilarMatchCheckResponse` was enabled
- Added request processing guards to prevent duplicate processing
- Added response saving guards to prevent duplicate saves
- API key anonymization in query parameters (previously only headers were anonymized)

### Changed
- Refactored `findBestMatchingMock` to use isolated utility functions
- Improved code maintainability and testability

## [Unreleased]

### Added
- Date manipulation documentation in README.md
- New example file `examples/date-example.ts` showing date manipulation features
- Mock data example for API testing

## [1.0.0] - 2024-03-16

### Added
- Initial release
- Basic API mocking functionality
- Date manipulation utilities
- Timezone support
- Environment variable configuration
- Automatic request interception
- Mock data storage and replay 