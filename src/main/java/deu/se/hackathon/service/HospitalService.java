package deu.se.hackathon.service;

import deu.se.hackathon.domain.Hospital;
import deu.se.hackathon.dto.HospitalDto;
import deu.se.hackathon.repository.HospitalRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
@RequiredArgsConstructor
public class HospitalService {

    private final HospitalRepository hospitalRepository;

    public Hospital saveHospital(HospitalDto dto) {
        Hospital hospital = Hospital.builder()
                .name(dto.getName())
                .address(dto.getAddress())
                .phoneNumber(dto.getPhoneNumber())
                .build();
        return hospitalRepository.save(hospital);
    }

    public List<Hospital> getAllHospitals() {
        return hospitalRepository.findAll();
    }
}
