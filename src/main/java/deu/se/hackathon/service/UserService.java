package deu.se.hackathon.service;

import deu.se.hackathon.domain.Hospital;
import deu.se.hackathon.domain.User;
import deu.se.hackathon.dto.UserDto;
import deu.se.hackathon.repository.HospitalRepository;
import deu.se.hackathon.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.Optional;

@Service
@RequiredArgsConstructor
public class UserService {

    private final UserRepository userRepository;
    private final HospitalRepository hospitalRepository;

    public User createUser(UserDto dto) {
        Hospital hospital = null;

        if ("HOSPITAL".equalsIgnoreCase(dto.getRole()) && dto.getHospitalId() != null) {
            hospital = hospitalRepository.findById(dto.getHospitalId())
                    .orElseThrow(() -> new IllegalArgumentException("병원이 존재하지 않습니다."));
        }

        User user = User.builder()
                .username(dto.getUsername())
                .password(dto.getPassword())
                .role(User.Role.valueOf(dto.getRole().toUpperCase()))
                .hospital(hospital)
                .build();

        return userRepository.save(user);
    }

    public Optional<User> findById(Long id) {
        return userRepository.findById(id);
    }
}
